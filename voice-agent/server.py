"""FastAPI server for the Sushra AI Pipecat agent (SmallWebRTC signalling).

Only the Next.js app (which checks the user's session) may call it: every request must carry
the shared secret header. Run:  uvicorn server:app --host 127.0.0.1 --port 7860
"""

from __future__ import annotations

import hmac
import os

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Request

from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.request_handler import (
    IceCandidate,
    SmallWebRTCPatchRequest,
    SmallWebRTCRequest,
    SmallWebRTCRequestHandler,
)

load_dotenv(override=True)

app = FastAPI(title="Sushra AI voice agent", docs_url=None, redoc_url=None)
handler = SmallWebRTCRequestHandler()


def _authorize(secret: str | None) -> None:
    expected = os.getenv("VOICE_AGENT_SHARED_SECRET", "")
    if not expected or not secret or not hmac.compare_digest(secret, expected):
        raise HTTPException(status_code=401, detail="unauthorized")


LOOPBACK = os.getenv("SV_LOOPBACK_TEST") in ("1", "audio")  # integration tests only


def _configured() -> dict[str, bool]:
    if LOOPBACK:
        return {"sarvam": True, "groq": True}
    return {"sarvam": bool(os.getenv("SARVAM_API_KEY")), "groq": bool(os.getenv("GROQ_API_KEY"))}


@app.on_event("startup")
async def _warm_up() -> None:
    """Import the bot (Pipecat, Sarvam, Silero) once at startup so the first call
    doesn't stall the WebRTC handshake while heavy modules load."""
    if not LOOPBACK:
        import bot  # noqa: F401


@app.get("/health")
async def health(x_sv_secret: str | None = Header(default=None)):
    _authorize(x_sv_secret)
    keys = _configured()
    return {"ok": all(keys.values()), "keys": keys}


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
        raise HTTPException(status_code=503, detail="SARVAM_API_KEY not set")
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
            async with session.post(
                "https://api.sarvam.ai/text-to-speech",
                json=payload,
                headers={"api-subscription-key": os.environ["SARVAM_API_KEY"], "Content-Type": "application/json"},
            ) as r:
                if r.status != 200:
                    raise HTTPException(status_code=502, detail="Sarvam TTS failed")
                data = await r.json()
                audios.extend(data.get("audios") or [])
    return {"mime": "audio/wav", "audios": audios}


@app.post("/api/offer")
async def offer(request: Request, background_tasks: BackgroundTasks, x_sv_secret: str | None = Header(default=None)):
    _authorize(x_sv_secret)
    if not all(_configured().values()):
        raise HTTPException(status_code=503, detail="SARVAM_API_KEY and GROQ_API_KEY must be set")
    body = await request.json()
    req = SmallWebRTCRequest.from_dict(body)
    request_data = req.request_data if isinstance(req.request_data, dict) else {}

    async def on_connection(connection: SmallWebRTCConnection):
        if os.getenv("SV_LOOPBACK_TEST") == "audio":
            from tests.loopback_audio_bot import run_bot
        elif LOOPBACK:
            from tests.loopback_bot import run_bot
        else:
            from bot import run_bot  # imported lazily so /health works without heavy deps loaded

        background_tasks.add_task(run_bot, connection, request_data)

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

    uvicorn.run(app, host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "7860")))
