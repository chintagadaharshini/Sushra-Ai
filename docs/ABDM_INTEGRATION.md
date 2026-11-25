# ABDM integration plan

Sushra AI is designed as a future **Health Information User (HIU)** and **PHR-style** client. ABDM is a federated
ecosystem: records stay with **Health Information Providers (HIPs)** and are shared only after the patient approves a
**consent request** in their consent manager / PHR app. This repo does **not** call any ABDM API today.

## What exists in code
- `src/server/abdm/types.ts`: contracts `HealthDataProvider`, `ConsentManager` and `FacilityDirectory` (HFR-like)
- `src/server/abdm/local-provider.ts`: the app-database implementation used by every API route
- `src/server/abdm/sandbox-provider.ts`: a stub that throws `AbdmNotConfiguredError` (no invented endpoints)
- `DATA_MODE=abdm_sandbox` switches providers. UI, voice and access-control code don't change.
- `src/lib/fhir.ts` + `GET /api/records/:id/fhir`: FHIR R4 Bundles (DiagnosticReport/Observation, MedicationRequest,
  DocumentReference), tagged `sushra-app`.

## Steps to go live on the sandbox
1. Register at the ABDM sandbox (https://sandbox.abdm.gov.in) and obtain a client ID/secret.
2. Follow the official “getting started with APIs” and HIU documentation on the sandbox site. Take endpoint paths and
   payloads **only** from there, and implement them in `sandbox-provider.ts`.
3. Register your bridge callback URL and HIU ID; create a test ABHA address on the sandbox PHR app.
4. Implement consent request → wait for grant → health-information request → receive and decrypt FHIR bundles
   (ECDH key exchange) → map to `RecordDetailDTO`.
5. Map voice consent requests to an on-screen review step. The assistant may *start* a consent request, but approval
   always happens in the patient's consent manager.
6. Map Health Facility Registry search to `FacilityDirectory`.
7. Complete the sandbox's functional test cases before any production exit.

Official references: https://abdm.gov.in · https://abha.abdm.gov.in · https://sandbox.abdm.gov.in
