"""The WebSocket session token minted by the Next.js app (src/server/voice-agent.ts) must verify here."""

import os

os.environ["VOICE_AGENT_SHARED_SECRET"] = "test-shared-secret-123"

from server import verify_session_token  # noqa: E402

# Minted with Node's createHmac exactly as mintVoiceToken() does (exp = 2100-01-01).
NODE_TOKEN = "eyJ1aWQiOiJkZW1vLXBhdGllbnQtbGFrc2htaSIsIm5hbWUiOiJMYWtzaG1pIiwicm9sZSI6IlBBVElFTlQiLCJsYW5nIjoidGUiLCJleHAiOjQxMDI0NDQ4MDB9.2SkmZfO9PHA3YI2RNVgW-yMA0OcP6GaSDcDyoei_y5Q"


def test_node_token_verifies():
    claims = verify_session_token(NODE_TOKEN)
    assert claims is not None
    assert claims["uid"] == "demo-patient-lakshmi" and claims["lang"] == "te" and claims["role"] == "PATIENT"


def test_tampered_token_rejected():
    payload, sig = NODE_TOKEN.split(".")
    assert verify_session_token(payload + "x." + sig) is None
    assert verify_session_token(payload + "." + sig[:-2] + "AA") is None
    assert verify_session_token(None) is None
    assert verify_session_token("garbage") is None


def test_expired_token_rejected():
    assert verify_session_token(NODE_TOKEN, now=4102444801) is None


def test_wrong_secret_rejected(monkeypatch):
    monkeypatch.setenv("VOICE_AGENT_SHARED_SECRET", "another-secret-value")
    assert verify_session_token(NODE_TOKEN) is None
