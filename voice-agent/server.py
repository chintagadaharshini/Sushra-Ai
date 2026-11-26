"""FastAPI server for the Sushra AI Pipecat agent.

Two ways to reach the same pipeline (Sarvam Saaras STT -> Groq LLM -> Sarvam Bulbul TTS):

* ``/ws`` (WebSocket, default): works behind HTTP-only hosts such as Render, whose proxy
  carries WebSockets but not the UDP media that WebRTC needs. The browser connects directly
  with a short-lived token minted by the signed-in Next.js app (HMAC with the shared secret).
* ``/api/offer`` (SmallWebRTC): for local/self-hosted setups where UDP is reachable.

Every other call must carry the shared secret header. Run:
    uvicorn server:app --host 0.0.0.0 --port 7860
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Request, WebSocket
from loguru import logger

from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.request_handler import (
    IceCandidate,
    SmallWebRTCPatchRequest,
    SmallWebRTCRequest,
    SmallWebRTCRequestHandler,
)

from transports import webrtc_transport, websocket_transport

load_dotenv(override=False)  # real environment variables (e.g. Render) win over a local .env

app = FastAPI(title="Sushra AI voice agent", docs_url=None, redoc_url=None)
handler = SmallWebRTCRequestHandler()

LOOPBACK = os.getenv("SV_LOOPBACK_TEST") in ("1", "audio")  # integration tests only


def _secret() -> str:
    return os.getenv("VOICE_AGENT_SHARED_SECRET", "")


def _authorize(secret: str | None) -> None:
    expected = _secret()
    if not expected or not secret or not hmac.compare_digest(secret, expected):
        raise HTTPException(status_code=401, detail="unauthorized")


def _b64d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def verify_session_token(token: str | None, now: float | None = None) -> dict | None:
    """Token = base64url(json payload) + "." + base64url(HMAC-SHA256(secret, payload)).
    Minted by the Next.js app (src/server/voice-agent.ts) for a signed-in user; valid ~2 minutes."""
    secret = _secret()
    if not secret or not token or token.count(".") != 1:
        return None
    payload_b64, sig_b64 = token.split(".")
    expected = hmac.new(secret.encode(), payload_b64.encode(), hashlib.sha256).digest()
    try:
        if not hmac.compare_digest(expected, _b64d(sig_b64)):
            return None
        payload = json.loads(_b64d(payload_b64))
    except (ValueError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict) or float(payload.get("exp", 0)) < (now or time.time()):
        return None
    return payload


def _configured() -> dict[str, bool]:
    if LOOPBACK:
        return {"sarvam": True, "groq": True}
    return {"sarvam": bool(os.getenv("SARVAM_API_KEY")), "groq": bool(os.getenv("GROQ_API_KEY"))}


@app.on_event("startup")
async def _warm_up() -> None:
    """Import the bot (Pipecat, Sarvam, Silero) once at startup so the first call
    doesn't stall while heavy modules load."""
    if not LOOPBACK:
        import bot  # noqa: F401
    logger.info(f"Voice agent ready (keys configured: {_configured()}, secret set: {bool(_secret())})")


@app.get("/healthz")
async def healthz():
    """Unauthenticated liveness probe (Render health check / wake-up ping). Reveals nothing secret."""
    return {"ok": True}


@app.get("/health")
async def health(x_sv_secret: str | None = Header(default=None)):
    _authorize(x_sv_secret)
    keys = _configured()
    return {"ok": all(keys.values()), "keys": keys, "transports": ["websocket", "webrtc"]}


TTS_LANG = {"en": "en-IN", "hi": "hi-IN", "te": "te-IN"}


def _chunks(text: str, limit: int = 450) -> list[str]:
    """Split on sentence boundaries (incl. Hindi danda) into Sarvam-sized pieces."""
    import re

    parts, cur = [], ""
    for sentence in re.split(r"(?<=[.!?।])\s+", text.strip()):
        if len(cur) + len(sentence) + 1 > limit and cur:
            parts.append(cur.strip())
            cur = ""
        cur += sentence + " "
    if cur.strip():
        parts.append(cur.strip())
    return [p[:limit] for p in parts][:8]


@app.post("/tts")
async def tts(request: Request, x_sv_secret: str | None = Header(default=None)):
    """Sarvam Bulbul speech for the browser-voice mode (devices often lack a Telugu voice)."""
    _authorize(x_sv_secret)
    if not os.getenv("SARVAM_API_KEY"):
        raise HTTPException(status_code=503, detail="SARVAM_API_KEY is not set on the voice agent")
    body = await request.json()
    text = str(body.get("text", ""))[:3000]
    lang = TTS_LANG.get(body.get("lang"), "en-IN")
    if not text.strip():
        raise HTTPException(status_code=400, detail="empty text")
    import aiohttp

    audios: list[str] = []
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30)) as session:
        for chunk in _chunks(text):
            payload = {
                "text": chunk,
                "target_language_code": lang,
                "speaker": os.getenv("TTS_VOICE", "priya"),
                "speech_sample_rate": 24000,
                "enable_preprocessing": True,
                "model": os.getenv("TTS_MODEL", "bulbul:v3"),
                "pace": 0.95,
            }
            try:
                async with session.post(
                    "https://api.sarvam.ai/text-to-speech",
                    json=payload,
                    headers={"api-subscription-key": os.environ["SARVAM_API_KEY"], "Content-Type": "application/json"},
                ) as r:
                    if r.status != 200:
                        detail = (await r.text())[:300]
                        logger.warning(f"Sarvam TTS HTTP {r.status}: {detail}")
                        raise HTTPException(status_code=502, detail=f"Sarvam TTS returned HTTP {r.status}: {detail}")
                    data = await r.json()
                    audios.extend(data.get("audios") or [])
            except aiohttp.ClientError as e:
                logger.warning(f"Sarvam TTS unreachable: {e}")
                raise HTTPException(status_code=502, detail="Sarvam TTS unreachable") from e
    if not audios:
        raise HTTPException(status_code=502, detail="Sarvam TTS returned no audio")
    return {"mime": "audio/wav", "audios": audios}


def _bot_module():
    if os.getenv("SV_LOOPBACK_TEST") == "audio":
        from tests import loopback_audio_bot as m
    elif LOOPBACK:
        from tests import loopback_bot as m
    else:
        import bot as m  # imported lazily so /healthz works without heavy deps loaded
    return m


@app.websocket("/ws")
async def ws(websocket: WebSocket):
    session = verify_session_token(websocket.query_params.get("token"))
    if session is None:
        await websocket.close(code=4401, reason="unauthorized")
        return
    if not all(_configured().values()):
        await websocket.close(code=4503, reason="SARVAM_API_KEY and GROQ_API_KEY must be set")
        return
    await websocket.accept()
    request_data = {"lang": session.get("lang"), "firstName": session.get("name"), "role": session.get("role")}
    m = _bot_module()
    try:
        await m.run_bot(websocket_transport(websocket), request_data)
    except Exception:  # keep the server alive; the client sees the socket close
        logger.exception("Voice session failed")


@app.post("/api/offer")
async def offer(request: Request, background_tasks: BackgroundTasks, x_sv_secret: str | None = Header(default=None)):
    _authorize(x_sv_secret)
    if not all(_configured().values()):
        raise HTTPException(status_code=503, detail="SARVAM_API_KEY and GROQ_API_KEY must be set")
    body = await request.json()
    req = SmallWebRTCRequest.from_dict(body)
    request_data = req.request_data if isinstance(req.request_data, dict) else {}

    async def on_connection(connection: SmallWebRTCConnection):
        m = _bot_module()
        background_tasks.add_task(m.run_bot, webrtc_transport(connection), request_data)

    return await handler.handle_web_request(request=req, webrtc_connection_callback=on_connection)


@app.patch("/api/offer")
async def ice(request: Request, x_sv_secret: str | None = Header(default=None)):
    _authorize(x_sv_secret)
    body = await request.json()
    patch = SmallWebRTCPatchRequest(
        pc_id=body["pc_id"] if "pc_id" in body else body["pcId"],
        candidates=[
            IceCandidate(candidate=c["candidate"], sdp_mid=c.get("sdp_mid", c.get("sdpMid")), sdp_mline_index=c.get("sdp_mline_index", c.get("sdpMLineIndex")))
            for c in body.get("candidates", [])
        ],
    )
    await handler.handle_patch_request(patch)
    return {"status": "success"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=os.getenv("HOST", "0.0.0.0"), port=int(os.getenv("PORT", "7860")))
