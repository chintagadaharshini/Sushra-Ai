import "server-only";
// ABDM sandbox adapter — INTENTIONALLY STUBBED.
//
// Real implementation steps (see docs/ABDM_INTEGRATION.md):
//  1. Register as an HIU on the ABDM sandbox (https://sandbox.abdm.gov.in) and obtain client credentials.
//  2. Obtain a gateway session token with those credentials.
//  3. Discover/link the patient's ABHA-linked care contexts.
//  4. Raise a consent request; wait for the patient's approval in their consent manager (PHR) app.
//  5. Request health information for the granted artefact; decrypt the FHIR bundles received on your
//     registered callback (ABDM uses ECDH key exchange for data transfer).
//  6. Map FHIR resources (DiagnosticReport, Observation, MedicationRequest...) to RecordDetailDTO.
//
// Endpoint paths and payloads MUST be taken from the current official ABDM sandbox documentation —
// they are deliberately not hard-coded here, so this file never calls an invented endpoint.
import { AbdmNotConfiguredError, type ConsentManager, type FacilityDirectory, type HealthDataProvider } from "./types";

export function abdmConfigured(): boolean {
  return Boolean(process.env.ABDM_BASE_URL && process.env.ABDM_CLIENT_ID && process.env.ABDM_CLIENT_SECRET);
}

export const sandboxHealthDataProvider: HealthDataProvider = {
  mode: "abdm_sandbox",
  async listRecords() {
    throw new AbdmNotConfiguredError("ABDM health record retrieval");
  },
  async getRecord() {
    throw new AbdmNotConfiguredError("ABDM health record retrieval");
  },
};

export const sandboxConsentManager: ConsentManager = {
  async requestConsent() {
    throw new AbdmNotConfiguredError("ABDM consent request");
  },
  async getConsentStatus() {
    throw new AbdmNotConfiguredError("ABDM consent status");
  },
};

export const sandboxFacilityDirectory: FacilityDirectory = {
  mode: "abdm_sandbox",
  async search() {
    throw new AbdmNotConfiguredError("Health Facility Registry search");
  },
};
