# Deploying Sushra AI on Render

Two Render **web services** from the same repository:

| | Web app (Next.js) | Voice agent (Python · Pipecat) |
|---|---|---|
| Example name | `sushra-voiceai` | `sushra-voiceai-agent` |
| Runtime | Node | Python 3 |
| Root directory | *(empty)* | `voice-agent` |
| Build command | `npm ci --include=dev && npm run build` | `pip install -r requirements.txt` |
| Start command | `npm run start:prod` | `uvicorn server:app --host 0.0.0.0 --port $PORT --no-access-log` |
| Health check path | `/api/health` | `/healthz` |

`npm run start:prod` (`scripts/render-start.mjs`) prints a warning for every missing setting, applies
migrations, seeds the sample accounts **only when the database is empty**, then starts Next.js.
Do **not** run `npm run setup` or `npm run db:seed` in the start command: the seed wipes every table,
so each restart would delete registered users and sign everyone out.

## Environment variables

**Web app**

| Key | Value |
|---|---|
| `SESSION_SECRET` | random string, at least 16 characters (e.g. `openssl rand -hex 32`). Without it sign-in and registration are refused with a clear message. |
| `DATABASE_URL` | `file:./prod.db` (free plan) or `file:/var/data/sushra.db` with a Render Disk mounted at `/var/data` |
| `VOICE_AGENT_URL` | public URL of the agent, e.g. `https://sushra-voiceai-agent.onrender.com` (no trailing slash) |
| `VOICE_AGENT_SHARED_SECRET` | random string, **identical** on both services |
| `NODE_VERSION` | `22` |
| `ANTHROPIC_API_KEY` | optional |

**Voice agent**

| Key | Value |
|---|---|
| `SARVAM_API_KEY` | from dashboard.sarvam.ai |
| `GROQ_API_KEY` | from console.groq.com/keys |
| `VOICE_AGENT_SHARED_SECRET` | same value as on the web app |
| `TTS_VOICE` / `TTS_MODEL` / `STT_MODEL` / `GROQ_MODEL` | optional; defaults `priya` / `bulbul:v3` / `saaras:v4` / `openai/gpt-oss-120b` |

## Why Studio voice uses a WebSocket

Render routes only HTTP(S) into a service. WebRTC media needs UDP between the browser and the
agent, so on Render the offer/answer succeeded but the media connection always timed out
(`Timeout establishing the connection to the remote peer`). Studio voice now streams audio and
RTVI messages over one WebSocket (`wss://<agent>/ws`), which Render's proxy carries. The browser
gets a 2-minute HMAC token from `/api/voice-agent/session` (signed-in users only); the agent
checks it with `VOICE_AGENT_SHARED_SECRET`. No TURN server is required.

## Free-plan behaviour

- Both services sleep after ~15 idle minutes. The first visit wakes the web app (~30 s); opening the
  assistant wakes the agent (the panel shows "Waking the Sarvam voice service…", up to ~60 s).
  Opening the site a minute before a demo avoids the wait.
- The SQLite file is on the instance disk: accounts registered on the live site disappear when the
  web service restarts or sleeps. The sample accounts (password `Sushra@123`) are always recreated.
  For durable data: upgrade the web service to a paid instance, add a Disk mounted at `/var/data`,
  and set `DATABASE_URL=file:/var/data/sushra.db`.

## Verifying a deployment

1. `https://<web-app>/api/health` → `{"ok":true,"db":true,"demoAccounts":4,"sessionSecret":true,"voiceAgent":{"sharedSecret":true,"url":"https"}}`
2. `https://<agent>/healthz` → `{"ok":true}`
3. Sign in as `lakshmi@sushra.in` / `Sushra@123`, open the assistant:
   - **Browser voice:** type "open my health records". The reply is spoken in Sarvam's voice. If Sarvam
     fails, a notice states the reason (e.g. invalid key) instead of switching voices silently.
   - **Studio voice · Sarvam:** wait for the start button, tap it, allow the microphone, and listen for the greeting in the chosen language.
4. Render logs of the agent show `Starting voice session (lang=te, transport=FastAPIWebsocketTransport)`.
