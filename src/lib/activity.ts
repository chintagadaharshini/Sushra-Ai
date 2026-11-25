export const ACTIVITY_LABEL: Record<string, string> = {
  SIGN_IN: "Signed in",
  RECORD_VIEW: "Viewed a health record",
  RECORD_EXPLAINED: "Got a simple-language explanation",
  RECORD_ADDED: "Added a self-reported record",
  CONSENT_GRANTED: "Allowed AI wording for explanations",
  CARE_ACCESS_GRANTED: "Shared records with care team",
  CARE_ACCESS_REVOKED: "Stopped sharing with care team",
  CLINICAL_NOTE_ADDED: "Added a clinical note",
  HOME_VISIT_RECORDED: "Recorded a home visit",
  PATIENT_REGISTERED_BY_ASHA: "Registered a patient",
  REGISTERED_PATIENT: "Created account",
  REGISTERED_DOCTOR: "Created account",
  REGISTERED_ASHA: "Created account",
  STUDIO_VOICE_SESSION: "Started a live voice conversation",
  CONSENT_REVOKED: "Revoked a consent",
  APPOINTMENT_REQUESTED: "Requested an appointment",
  APPOINTMENT_CANCELLED: "Cancelled an appointment",
  VOICE_OPEN_RECORDS: "Opened records by voice",
  VOICE_OPEN_RECORD: "Opened a record by voice",
  VOICE_EXPLAIN_RECORD: "Explained a report by voice",
  VOICE_FACILITY_SEARCH: "Searched facilities by voice",
  VOICE_PREFERENCE_UPDATE: "Updated a preference by voice",
  VOICE_FORM_FILL: "Filled a form field by voice",
  FORM_UPDATE_DECLINED: "Declined a proposed change",
  SENSITIVE_INPUT_BLOCKED: "Assistant blocked sensitive input",
  FHIR_EXPORT: "Exported a record as FHIR R4",
  AI_EXPLANATION: "AI explanation (with consent)",
};
export function activityLabel(action: string) {
  if (action.startsWith("PREFERENCE_UPDATED")) return `Updated preferences (${action.split(":")[1] ?? ""})`;
  return ACTIVITY_LABEL[action] ?? action.replaceAll("_", " ").toLowerCase();
}
