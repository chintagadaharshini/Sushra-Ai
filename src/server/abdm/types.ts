// ABDM-ready integration contracts.
//
// ABDM is a federated ecosystem: health records stay with Health Information
// Providers (HIPs); a Health Information User (HIU, e.g. this app) can only fetch
// them after the patient approves a consent request through a Consent Manager.
// These interfaces model that flow so a real sandbox implementation can be
// dropped in without touching UI or voice code.
import type { RecordDetailDTO, RecordSummaryDTO } from "@/lib/domain";

export type DataMode = "local" | "abdm_sandbox";

export interface RecordQuery {
  recordType?: string;
  category?: string;
  q?: string;
}

/** Read access to a patient's linked records (HIU perspective). */
export interface HealthDataProvider {
  readonly mode: DataMode;
  listRecords(patientId: string, query?: RecordQuery): Promise<RecordSummaryDTO[]>;
  /** Must return null when the record does not belong to the patient. */
  getRecord(patientId: string, recordId: string): Promise<RecordDetailDTO | null>;
}

export interface ConsentRequestInput {
  patientId: string;
  purpose: "CAREMGT" | "PATRQT" | "SELF_EXPLANATION";
  hiTypes: string[]; // e.g. ["DiagnosticReport", "Prescription"] (FHIR-aligned)
  dateRange: { from: string; to: string };
}
export interface ConsentManager {
  requestConsent(input: ConsentRequestInput): Promise<{ requestId: string; status: "REQUESTED" | "GRANTED" | "DENIED" }>;
  getConsentStatus(requestId: string): Promise<"REQUESTED" | "GRANTED" | "DENIED" | "EXPIRED" | "REVOKED">;
}

export interface FacilityQuery {
  city?: string;
  facilityType?: string;
  q?: string;
  service?: string;
}
export interface FacilityDTO {
  id: string;
  name: string;
  facilityType: string;
  ownership: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  services: string[];
  openHours: string;
  isDemo: boolean;
}
/** Facility lookup (would map to the Health Facility Registry in ABDM). */
export interface FacilityDirectory {
  readonly mode: DataMode;
  search(query: FacilityQuery): Promise<FacilityDTO[]>;
}

export class AbdmNotConfiguredError extends Error {
  code = "ABDM_NOT_CONFIGURED";
  constructor(what: string) {
    super(
      `${what} is not available: ABDM sandbox integration requires approved credentials and has not been configured. ` +
        `See docs/ABDM_INTEGRATION.md. No request was sent.`,
    );
  }
}
