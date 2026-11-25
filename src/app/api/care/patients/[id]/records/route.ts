import { ApiError, json, withAuth } from "@/server/http";
import { prisma } from "@/server/db";
import { activeCareConsent } from "@/server/care";
import { audit } from "@/server/audit";
import { ashaVisitSchema, doctorNoteSchema } from "@/lib/domain";
import { consultationExplain, homeVisitExplain, prescriptionExplain } from "@/lib/care-notes";

/** Doctors add consultation notes / prescriptions; ASHA workers record home visits. Consent required. */
export const POST = withAuth<{ params: Promise<{ id: string }> }>(async (req, user, { params }) => {
  if (req.headers.get("x-sv-channel") === "VOICE") throw new ApiError(403, "Clinical entries must be submitted on screen.", "HUMAN_REQUIRED");
  const { id: patientId } = await params;
  if (!(await activeCareConsent(user.id, patientId))) throw new ApiError(404, "Patient not found", "NOT_FOUND");
  const raw = await req.json();
  const now = new Date();
  const base = { patientId, recordDate: now, authorUserId: user.id, keywords: "" };

  let record;
  if (user.role === "DOCTOR") {
    const d = user.doctorProfile!;
    const input = doctorNoteSchema.parse(raw);
    const common = { ...base, facilityName: d.facilityName, authorType: "CLINICIAN", authorName: d.fullName, source: "CLINICIAN_ENTERED", verificationStatus: "CLINICIAN_ENTERED" };
    if (input.kind === "CONSULTATION") {
      record = await prisma.healthRecord.create({
        data: {
          ...common, recordType: "CONSULTATION", category: "consultation", title: `${d.specialization} Consultation`,
          summary: `${input.chiefComplaint}${input.followUp ? ` · Follow-up: ${input.followUp}` : ""}`,
          keywords: "consultation doctor visit परामर्श కన్సల్టేషన్",
          detailsJson: JSON.stringify({ chiefComplaint: input.chiefComplaint, clinicianNotes: input.notes, plan: input.plan, followUp: input.followUp, explain: consultationExplain(d.fullName, now, input.chiefComplaint, input.plan, input.followUp) }),
        },
      });
    } else {
      record = await prisma.healthRecord.create({
        data: {
          ...common, recordType: "PRESCRIPTION", category: "prescription", title: `Prescription — ${d.specialization}`,
          summary: `${input.medications.length} medicine(s) prescribed by ${d.fullName}.`,
          keywords: "prescription medicine दवा ప్రిస్క్రిప్షన్ మందులు",
          detailsJson: JSON.stringify({ medications: input.medications, notes: input.notes, explain: prescriptionExplain(d.fullName, now, input.medications) }),
        },
      });
    }
  } else {
    const a = user.ashaProfile!;
    const v = ashaVisitSchema.parse(raw);
    const vitals = {
      bp: v.systolic ? `${v.systolic}/${v.diastolic} mmHg` : undefined,
      weight: v.weightKg ? `${v.weightKg} kg` : undefined,
      sugar: v.bloodSugar ? `${v.bloodSugar} mg/dL (home glucometer)` : undefined,
    };
    const readings = Object.values(vitals).filter(Boolean).join(", ");
    record = await prisma.healthRecord.create({
      data: {
        ...base, recordType: "HOME_VISIT", category: "home_visit", title: "ASHA Home Visit", facilityName: `Home visit · ${a.village}`,
        authorType: "ASHA", authorName: `${a.fullName} (ASHA)`, source: "ASHA_ENTERED", verificationStatus: "ASHA_RECORDED",
        summary: [readings, v.notes].filter(Boolean).join(". ") || "Home visit",
        keywords: "asha home visit vitals ఆశా ఇంటి సందర్శన आशा घर",
        detailsJson: JSON.stringify({ vitals, notes: v.notes, explain: homeVisitExplain(a.fullName, now, vitals) }),
      },
    });
  }
  await audit({ userId: user.id, action: user.role === "DOCTOR" ? "CLINICAL_NOTE_ADDED" : "HOME_VISIT_RECORDED", entity: "HealthRecord", entityId: record.id });
  return json({ record: { id: record.id, title: record.title } }, 201);
}, ["DOCTOR", "ASHA"]);
