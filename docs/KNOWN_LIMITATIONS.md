# Known limitations

## Verified vs. unverified
- **Verified in this build:** typecheck, production build, 112 unit/integration tests, 21 Playwright tests in real Chrome
  (incl. registration for all three roles, doctor notes, ASHA visits/assisted registration, sharing and revoking),
  6 Python tests, and (previous build) a Studio-voice **loopback** run (Chrome → Next.js proxy → Pipecat SmallWebRTC → RTVI data
  channel → browser executor → result back to Python), with navigation, explanation, confirm-and-save and a rejected
  sensitive field.
- **Telugu voice fixes (from your Windows test log):** echo protection (mic muted while the bot speaks), WebRTC playback
  for echo cancellation, Saaras v4 keyterms, de-duplicated bot captions, and Sarvam TTS for browser mode. These are built
  and unit/import-tested, but **not yet verified against live Sarvam/Groq** from here; please re-test on your machine.
- **Studio voice playback bug (fixed):** the bot's WebRTC audio track was received but never played. It is now attached
  to an `<audio>` element. This was verified in Chrome with a loopback bot that streams audible audio over the same path.
- **Not verified here:** live Sarvam Saaras/Bulbul and Groq calls (no API keys or network access in the build
  environment), and real microphone speech recognition (headless Chrome has no speech service). Typed commands run the
  identical pipeline after the speech-to-text step.

## Voice
- Browser voice depends on the browser's speech service: best in Chrome/Edge; Safari varies; Firefox has none.
- Telugu speech **output** needs a Telugu voice installed on the device (often missing on Windows). Text is always shown.
- Language is chosen explicitly (EN/हिं/తె). Automatic language detection is not enabled.
- The deterministic intent engine covers the documented commands and common variations; very free-form phrasing may
  need the optional LLM fallback (browser voice) or Studio voice (Groq).
- Studio voice language is fixed per session; switching language reconnects.

## Data & integration
- Seeded data is fictional. No live ABDM/ABHA connectivity; the sandbox adapter is an interface plus stub that refuses safely.
- In-app sharing consents are not ABDM consent artefacts. Appointment requests stay "not yet confirmed": no facility workflow exists yet.
- Doctor registration numbers are not checked against the medical council (they show as "verification pending");
  ASHA IDs are self-declared. Account verification and password reset are not implemented.
- FHIR export uses local demo codes (not validated LOINC/SNOMED) and is not checked against ABDM FHIR profiles.
- Facility directory is fictional; there is no geolocation or live availability.

## Platform
- SQLite for the demo. For PostgreSQL, switch the Prisma datasource and use `@prisma/adapter-pg`.
- Sign-in is email/mobile + password with a signed cookie; there is no OTP or ABHA login.
- The Studio voice server handles each session in-process (one Render instance); scale-out is out of scope.
- **Render free plan:** both services sleep after ~15 idle minutes; the first request takes 30–60 s (the app shows "Waking the Sarvam voice service…"). The SQLite file lives on the instance disk, so accounts registered by users are lost when the web service restarts or sleeps; the sample accounts are recreated automatically. For persistent data attach a Render Disk (paid plan) — see docs/DEPLOYMENT.md.
