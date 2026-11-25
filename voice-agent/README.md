# Sushra AI — Studio voice agent (FastAPI + Pipecat)

Real-time conversation: **WebRTC → Sarvam Saaras (STT) → Groq LLM with tools → Sarvam Bulbul (TTS) → WebRTC**.

- `server.py`: FastAPI signalling (`POST/PATCH /api/offer`, `GET /health`), protected by `VOICE_AGENT_SHARED_SECRET`.
  Only the Next.js app calls it (through `/api/voice-agent/*`, which checks the user's session).
- `bot.py`: the Pipecat pipeline (Silero VAD for turn-taking and barge-in).
- `actions.py`: tool schemas (enums only), argument validation, and the RTVI request/response bridge.
- `prompts.py`: system prompt (reply in the selected language, never fake success, no diagnoses, refuse credentials).

The bot **does not** read or write patient data. Tools are executed by the user's browser through the app's guarded
executor, and the verified result is returned to the LLM.

```bash
pip install -r requirements.txt
cp .env.example .env    # SARVAM_API_KEY, GROQ_API_KEY, VOICE_AGENT_SHARED_SECRET
python server.py
pytest -q
```
