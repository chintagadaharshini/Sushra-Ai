// Minimal HL7 FHIR R4 mapping for interoperability (ABDM uses FHIR R4 profiles).
// Produces a "collection" Bundle. Codes are local (no claim of LOINC/SNOMED validation).
import type { RecordDetailDTO } from "./domain";

const LOCAL = "https://sushra.example/fhir/CodeSystem/local-tests";

export function recordToFhirBundle(r: RecordDetailDTO, patient: { id: string; name: string; gender: string; birthYear: number }) {
  const patientRef = `Patient/${patient.id}`;
  const entries: unknown[] = [
    {
      fullUrl: `urn:uuid:patient-${patient.id}`,
      resource: {
        resourceType: "Patient",
        id: patient.id,
        meta: { tag: [{ system: "https://sushra.example/tags", code: "sushra-app" }] },
        name: [{ text: patient.name }],
        gender: patient.gender.toLowerCase() === "female" ? "female" : patient.gender.toLowerCase() === "male" ? "male" : "unknown",
        birthDate: String(patient.birthYear),
      },
    },
  ];
  const tag = { tag: [{ system: "https://sushra.example/tags", code: "sushra-app" }] };

  if (r.recordType === "LAB_REPORT") {
    const obsIds = r.labResults.map((l) => `obs-${l.id}`);
    r.labResults.forEach((l) => {
      entries.push({
        fullUrl: `urn:uuid:obs-${l.id}`,
        resource: {
          resourceType: "Observation",
          id: `obs-${l.id}`,
          meta: tag,
          status: "final",
          category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory" }] }],
          code: { coding: [{ system: LOCAL, code: l.testCode, display: l.testName }], text: l.testName },
          subject: { reference: patientRef },
          effectiveDateTime: r.recordDate,
          ...(l.value != null ? { valueQuantity: { value: l.value, unit: l.unit } } : { valueString: l.valueText }),
          referenceRange: [{ ...(l.refLow != null ? { low: { value: l.refLow, unit: l.unit } } : {}), ...(l.refHigh != null ? { high: { value: l.refHigh, unit: l.unit } } : {}), ...(l.refText ? { text: l.refText } : {}) }],
        },
      });
    });
    entries.push({
      fullUrl: `urn:uuid:dr-${r.id}`,
      resource: {
        resourceType: "DiagnosticReport",
        id: `dr-${r.id}`,
        meta: tag,
        status: "final",
        code: { text: r.title },
        subject: { reference: patientRef },
        effectiveDateTime: r.recordDate,
        performer: [{ display: r.facilityName }],
        result: obsIds.map((id) => ({ reference: `Observation/${id}` })),
        conclusion: r.summary,
      },
    });
  } else if (r.recordType === "PRESCRIPTION") {
    const meds = (r.details.medications as { name: string; dose: string; frequency: string; duration: string }[]) ?? [];
    meds.forEach((m, i) =>
      entries.push({
        fullUrl: `urn:uuid:mr-${r.id}-${i}`,
        resource: {
          resourceType: "MedicationRequest",
          id: `mr-${r.id}-${i}`,
          meta: tag,
          status: "active",
          intent: "order",
          medicationCodeableConcept: { text: m.name },
          subject: { reference: patientRef },
          authoredOn: r.recordDate,
          requester: { display: r.authorName },
          dosageInstruction: [{ text: `${m.dose}, ${m.frequency}, ${m.duration}` }],
        },
      }),
    );
  } else {
    entries.push({
      fullUrl: `urn:uuid:doc-${r.id}`,
      resource: {
        resourceType: "DocumentReference",
        id: `doc-${r.id}`,
        meta: tag,
        status: "current",
        type: { text: r.title },
        subject: { reference: patientRef },
        date: r.recordDate,
        author: [{ display: r.authorName }],
        description: r.summary,
        content: [{ attachment: { contentType: "text/plain", title: r.title } }],
      },
    });
  }
  return { resourceType: "Bundle", type: "collection", timestamp: new Date().toISOString(), meta: tag, entry: entries };
}
