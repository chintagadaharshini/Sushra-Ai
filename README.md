# Sushra AI

**A multilingual (Telugu · Hindi · English) voice-first digital healthcare app inspired by India's ABDM ecosystem.**
Theme 03 — HealthTech & Bio-Innovation.

> Independent app, not affiliated with NHA/ABDM/ABHA. The seeded accounts, records and facilities are fictional sample data.

Three kinds of users sign in: **patients**, **doctors** and **ASHA workers**. Elderly, rural and regional-language users can run the app by **talking to it**. The assistant isn't a chatbot bolted on.
It performs real, verified actions: opening records, explaining reports in simple Telugu or Hindi, filtering hospitals,
and filling forms after confirmation. It never claims success it didn't verify.

---

## What's inside

| Layer | Technology | Status |
|---|---|---|
| Frontend | Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn-style UI · Lucide · Framer Motion | ✅ built & tested |
| App backend | Next.js Route Handlers (auth, records, facilities, appointments, preferences, consents, audit, FHIR export) | ✅ built & tested |
| Database | Prisma 7 + SQLite (zero-config), schema portable to PostgreSQL | ✅ |
| Voice engine 1 — **Browser voice** | Web Speech API (te-IN / hi-IN / en-IN) + SpeechSynthesis + deterministic trilingual intent engine | ✅ works with no API keys |
| Voice engine 2 — **Studio voice** | Python **FastAPI + Pipecat** · **Sarvam Saaras** STT · **Sarvam Bulbul** TTS · **Groq** LLM with tool calling · **WebRTC** (SmallWebRTC) | ✅ built; transport + tool bridge tested end-to-end; live Sarvam/Groq calls need your keys (unverified here) |
| Interoperability | ABDM adapter interfaces (local provider + sandbox stub) · **HL7 FHIR R4** Bundle export | ✅ |

### Roles & access

| | Patient | Doctor | ASHA worker |
|---|---|---|---|
| Own records, appointments, explanations | ✅ | — | — |
| Share records with a doctor/ASHA (1–12 months) and stop sharing | ✅ | — | — |
| See patients who shared with them | — | ✅ | ✅ |
| Add consultation notes / prescriptions | — | ✅ | — |
| Record home visits (BP, weight, sugar, notes) | — | — | ✅ |
| Register a patient without email (mobile + one-time password), with the patient's consent | — | — | ✅ |
| Voice in Telugu / Hindi / English | ✅ | ✅ | ✅ |

Care access is **consent-based**: a doctor or ASHA worker can open a patient only while that patient has an active
sharing consent for them. Revoking or expiry removes access immediately (`src/server/care.ts`). Doctors' registration
numbers are shown as *verification pending* until verified.

## How a voice command runs (both engines share the same safety core)

```
speech ─► text ─► intent (deterministic for critical actions; LLM proposals are Zod/Pydantic-validated)
       ─► parameters ─► validation/whitelist ─► confirmation (for data changes)
       ─► execute real UI/API action ─► VERIFY outcome (page loaded, server echoed saved value…)
       ─► speak + show result   (failure is reported honestly)
```

In **Studio voice**, the Pipecat bot never touches data. Each LLM tool call is validated in Python
(`voice-agent/actions.py`), sent over the WebRTC data channel to the signed-in browser, executed by the
**same** guarded executor (`src/lib/voice/executor.ts`), and the verified result goes back to the LLM to be spoken.

---

## Quick start (Browser voice — no keys needed)

Requirements: **Node.js 20+** and **Chrome or Edge** (for voice input).

```bash
cd sushra-ai
cp .env.example .env            # set SESSION_SECRET to any long random string
npm install                     # also runs `prisma generate`
npm run setup                   # applies the migration and seeds synthetic data
npm run dev                     # http://localhost:3000
```

**Sample accounts** (password `Sushra@123` for all; sign in with email *or* mobile number):

| Role | Email | Mobile |
|---|---|---|
| Patient | `lakshmi@sushra.in` | 9000000001 |
| Patient (shares with no one) | `ravi@sushra.in` | 9000000002 |
| Doctor | `dr.srinivas@sushra.in` | 9000000003 |
| ASHA worker | `padma.asha@sushra.in` | 9000000004 |

New users register at `/register` as Patient, Doctor or ASHA worker. Choosing the wrong role tab at sign-in shows which role the account belongs to.

> Upgrading from the first version? Run `npm run setup` again: it applies the new `roles` migration and re-seeds (old `@demo` logins are replaced).

> If your network blocks Prisma's engine download, use `node scripts/apply-migrations-offline.mjs && npm run db:seed`
> instead of `npm run setup`. Reset sample data any time with `npm run db:seed`.

## Studio voice (Pipecat + Sarvam + Groq)

Requires Python 3.11+, a **Sarvam AI** key (https://dashboard.sarvam.ai) and a **Groq** key (https://console.groq.com/keys).

```bash
cd voice-agent
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env     # add SARVAM_API_KEY, GROQ_API_KEY and a VOICE_AGENT_SHARED_SECRET
python server.py         # http://127.0.0.1:7860 (only reachable through the Next.js app)
```

Then add the **same** secret to the Next.js `.env`:

```
VOICE_AGENT_URL="http://127.0.0.1:7860"
VOICE_AGENT_SHARED_SECRET="<same value>"
```

Restart `npm run dev`, open the assistant, choose **Studio voice · Sarvam**, then tap the green button and just talk.
Changing the language reconnects with the new Sarvam language.

**How the bot's voice reaches your speakers:** Pipecat's SmallWebRTC transport delivers Sarvam's audio as a remote
WebRTC track but does not play it. `use-studio-voice.ts` attaches that track to a hidden `<audio>` element. If the
browser blocks autoplay, the panel shows a "Tap to hear the assistant" button.

**When the voice service is running, Browser voice also speaks through Sarvam Bulbul.** This matters for Telugu, because
most Windows PCs have no Telugu voice installed. Without the service, replies use the device's own voices.

**Echo protection.** On laptop or phone speakers, the assistant used to hear its own voice and treat it as the user
speaking (garbled transcripts and constant interruptions). So by default the microphone is muted while the assistant
talks, and the browser plays the bot through WebRTC so that echo cancellation works. With headphones, set
`STUDIO_BARGE_IN=1` to allow interrupting. Saaras v4 also gets app vocabulary "keyterms" in Telugu, Hindi and English.

---

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | Next.js | SQLite file, default `file:./dev.db` |
| `SESSION_SECRET` | Next.js | HMAC key for session cookies (required in production) |
| `DATA_MODE` | Next.js | `local` (default) or `abdm_sandbox` (stub; fails safely) |
| `ABDM_BASE_URL`, `ABDM_CLIENT_ID`, `ABDM_CLIENT_SECRET`, `ABDM_HIU_ID` | Next.js | Future sandbox integration |
| `ANTHROPIC_API_KEY`, `LLM_MODEL` | Next.js | Optional: LLM fallback for unrecognised browser-voice phrases + AI-worded explanations (consent-gated) |
| `VOICE_AGENT_URL`, `VOICE_AGENT_SHARED_SECRET` | Next.js | Connects the Studio voice agent |
| `NEXT_PUBLIC_PIPECAT_MEDIA_MANAGER` | Next.js | `local` swaps in a WebAudio player (no CDN script, weaker echo cancellation). The default WebRTC device manager loads a small script from Daily's CDN |
| `SARVAM_API_KEY`, `GROQ_API_KEY`, `GROQ_MODEL`, `STT_MODEL`, `TTS_MODEL`, `TTS_VOICE` | voice-agent | Models (defaults `openai/gpt-oss-120b`, `saaras:v4`, `bulbul:v3`, female voice `priya`) |
| `STUDIO_BARGE_IN` | voice-agent | `1` to allow interrupting the assistant (use headphones); default `0` |

---

## Try the scenarios

Sign in as Lakshmi (patient). Open the assistant (bottom-right, or **Alt+V** to start listening). Pick EN / हिं / తె, then speak or type:

| # | Say | What visibly happens |
|---|---|---|
| 1 | “నా హెల్త్ రికార్డ్స్ చూపించు.” | Records page opens; Telugu spoken reply |
| 2 | “Show me my latest blood test report.” | Newest CBC (18 Nov 2026) opens |
| 3 | “मेरी मेडिकल रिपोर्ट समझाओ।” | Asks which report → say “पहला” → Hindi explanation |
| 4 | “Change my preferred city to Hyderabad.” → “Yes.” | Confirmation card → profile field updates → saved & verified |
| 5 | “Find hospitals near Visakhapatnam.” | Facility search with city + type filters applied (2 results) |
| 6 | “Open my records.” → “Open the latest one.” → “Explain it in Telugu.” | Context carried across turns |
| 7 | (Doctor) “Open my patients” → open Lakshmi → open a report → “इसे हिंदी में समझाओ” | Doctor explains a shared report |
| 8 | (ASHA) “కొత్త రోగిని నమోదు చేయి” | Opens assisted patient registration |

More commands: **Help & Voice Guide** page (every command is one tap away).

---

## Tests

```bash
npm run typecheck        # TypeScript
npm test                 # 111 unit/integration tests (Vitest; real seeded SQLite DB)
npm run build            # production build
CHROME_PATH=/path/to/chrome npm run e2e     # 21 Playwright browser tests (or `npx playwright install chromium`)
cd voice-agent && pytest -q                 # 6 Python tests (tool validation + action bridge)
```

Coverage: role sign-in/registration, consent-based care access (grant, revoke, expiry), doctor notes, ASHA visits and
assisted registration, patient access control, record retrieval, Telugu/Hindi/English command mapping, conversational context,
form confirmation (incl. failed / mismatched saves), blocked sensitive input (Aadhaar/OTP/passwords),
language switching, speech-recognition errors, unsupported speech APIs, write-field whitelists,
FHIR export, the six required scenarios, and the Pipecat tool whitelist.

**Studio voice audio test** (no keys needed — proves the bot's WebRTC audio is actually *played*):

```bash
cd voice-agent && SV_LOOPBACK_TEST=audio VOICE_AGENT_SHARED_SECRET=<same> python server.py
STUDIO_AUDIO_TEST=1 npm run e2e -- studio-audio
```

**Studio voice loopback test** (no keys needed — proves WebRTC + data channel + browser executor):

```bash
cd voice-agent && SV_LOOPBACK_TEST=1 VOICE_AGENT_SHARED_SECRET=<same> python server.py
# then open the app → assistant → Studio voice → start; results are written to /tmp/sv-loopback.json
```

### Manual checklist — microphone & browsers

- [ ] Chrome desktop: allow mic on first tap; green dot + waveform while listening; transcript appears live
- [ ] Say a Telugu, a Hindi and an English command with the matching language selected
- [ ] Deny mic permission → clear message, typing still works
- [ ] Firefox → “voice input isn't supported” banner, typing works
- [ ] Windows without a Telugu TTS voice → notice shown, text reply still displayed
- [ ] Mic indicator turns off after each command; nothing records in the background
- [ ] Studio voice: barge in while the bot is talking — it stops and listens
- [ ] Studio voice: “set my city to Guntur” → confirmation card appears → say “yes” → field updates

---

## Folder structure

```
sushra-ai/
├─ prisma/                 schema.prisma · migrations/ · seed.ts (synthetic data only)
├─ src/
│  ├─ app/                 landing, /login, /register, (app)/dashboard|facilities|profile|privacy|help
│  │  ├─ (app)/(patient)/  records, records/[id], appointments           (patients only)
│  │  ├─ (app)/(care)/     patients, patients/[id], …/records/[rid], patients/register   (doctors & ASHA)
│  │  └─ api/              auth (login, register) · care (patients, records, register-patient, directory) · tts
│  │                       me · records (+explain, +fhir) · facilities · appointments · preferences
│  │                       consents · activity · audit · assistant/interpret · integration/status · voice-agent/{offer,status}
│  ├─ components/
│  │  ├─ assistant/        voice-assistant.tsx · use-assistant-engine.ts · use-studio-voice.ts · use-mic-level.ts
│  │  ├─ app/              app shell, onboarding, charts…   └─ ui/  button, card, badge, fields
│  ├─ lib/
│  │  ├─ voice/            intents.ts (te/hi/en) · executor.ts · responses.ts · speech.ts (adapters) · store.ts · form-bridge.ts
│  │  ├─ explain.ts        grounded report explanations (te/hi/en)
│  │  ├─ fhir.ts           FHIR R4 Bundle mapping
│  │  └─ domain.ts         shared types, validation, sensitive-data patterns
│  └─ server/              db · session/crypto · http · audit · llm (optional) · voice-agent proxy
│     └─ abdm/             types.ts (HIU/consent/facility contracts) · local-provider · sandbox-provider (stub)
├─ voice-agent/            FastAPI + Pipecat: server.py · bot.py · actions.py · prompts.py · tests/
├─ tests/unit/             Vitest suites          e2e/  Playwright scenarios
└─ docs/ABDM_INTEGRATION.md
```

## Security & privacy design

- Mic only after an explicit tap; visible listening state; no raw audio stored; conversation memory is in-tab only.
- Audit log records *which action* happened (and whether by voice), never transcripts or clinical values.
- Every record query is scoped to the signed-in patient, or to a doctor/ASHA with an active consent from that patient;
  anything else returns 404. Patient-only and care-only pages are guarded by role on the server.
- Passwords are salted scrypt hashes; sessions are HMAC-signed, httpOnly cookies.
- Data changes need confirmation; only whitelisted preference fields are writable (strict Zod schema).
- Appointment requests and consents are refused from the assistant channel. A human must submit them on screen.
- Passwords, OTPs, Aadhaar and ABHA credentials are refused, both in the browser and in the Python tool layer.
- API keys stay server-side; the Pipecat agent is reachable only through the authenticated Next.js proxy (shared secret).
- Explanations compare values only with the lab's printed reference range, and never diagnose or prescribe.

## Known limitations

See **[docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md)**.
