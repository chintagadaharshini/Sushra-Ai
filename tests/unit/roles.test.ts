// Role-based access against the seeded database: patients, doctors, ASHA workers.
import { beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { activeCareConsent, canViewPatient, listCarePatients } from "@/server/care";
import { ashaVisitSchema, assistedPatientSchema, doctorNoteSchema, registerSchema } from "@/lib/domain";
import { consultationExplain, homeVisitExplain } from "@/lib/care-notes";

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: "file:./test.db" }) });
let doctorId = "", ashaId = "", lakshmi = "", ravi = "";

beforeAll(async () => {
  doctorId = (await prisma.user.findUniqueOrThrow({ where: { email: "dr.srinivas@sushra.in" } })).id;
  ashaId = (await prisma.user.findUniqueOrThrow({ where: { email: "padma.asha@sushra.in" } })).id;
  lakshmi = (await prisma.patientProfile.findFirstOrThrow({ where: { user: { email: "lakshmi@sushra.in" } } })).id;
  ravi = (await prisma.patientProfile.findFirstOrThrow({ where: { user: { email: "ravi@sushra.in" } } })).id;
});

describe("consent-based care access", () => {
  it("doctor and ASHA see only patients who shared with them", async () => {
    expect((await listCarePatients(doctorId)).map((p) => p.patientId)).toEqual([lakshmi]);
    expect((await listCarePatients(ashaId)).map((p) => p.patientId)).toEqual([lakshmi]);
    expect(await canViewPatient({ id: doctorId, role: "DOCTOR", profile: null }, lakshmi)).toBe(true);
    expect(await canViewPatient({ id: doctorId, role: "DOCTOR", profile: null }, ravi)).toBe(false);
  });
  it("revoked or expired consent removes access", async () => {
    const c = (await activeCareConsent(doctorId, lakshmi))!;
    await prisma.consentRecord.update({ where: { id: c.id }, data: { status: "REVOKED" } });
    expect(await activeCareConsent(doctorId, lakshmi)).toBeNull();
    await prisma.consentRecord.update({ where: { id: c.id }, data: { status: "GRANTED", expiresAt: new Date(Date.now() - 1000) } });
    expect(await activeCareConsent(doctorId, lakshmi)).toBeNull();
    await prisma.consentRecord.update({ where: { id: c.id }, data: { expiresAt: new Date(Date.now() + 864e5) } });
    expect(await activeCareConsent(doctorId, lakshmi)).not.toBeNull();
  });
  it("a patient can view only their own profile", async () => {
    expect(await canViewPatient({ id: "x", role: "PATIENT", profile: { id: lakshmi } as never }, lakshmi)).toBe(true);
    expect(await canViewPatient({ id: "x", role: "PATIENT", profile: { id: lakshmi } as never }, ravi)).toBe(false);
  });
  it("seeded accounts have the profile matching their role", async () => {
    const users = await prisma.user.findMany({ include: { profile: true, doctorProfile: true, ashaProfile: true } });
    for (const u of users) {
      if (u.role === "PATIENT") expect(u.profile).not.toBeNull();
      if (u.role === "DOCTOR") expect(u.doctorProfile).not.toBeNull();
      if (u.role === "ASHA") expect(u.ashaProfile).not.toBeNull();
    }
  });
});

describe("registration validation", () => {
  const common = { fullName: "Sita Rao", email: "sita@example.com", phone: "9876543210", password: "Health2026", preferredLanguage: "te" };
  it("accepts each role with its own fields", () => {
    expect(registerSchema.safeParse({ role: "PATIENT", ...common, gender: "Female", yearOfBirth: 1970, city: "Guntur" }).success).toBe(true);
    expect(registerSchema.safeParse({ role: "DOCTOR", ...common, registrationNumber: "APMC/2011/5521", specialization: "Cardiology", facilityName: "City Hospital", city: "Hyderabad" }).success).toBe(true);
    expect(registerSchema.safeParse({ role: "ASHA", ...common, ashaId: "AP-GNT-1201", village: "Tenali", district: "Guntur", phcName: "Tenali PHC" }).success).toBe(true);
  });
  it("rejects weak passwords, bad phones, missing role fields and extra fields", () => {
    expect(registerSchema.safeParse({ role: "PATIENT", ...common, password: "short", gender: "Female", yearOfBirth: 1970, city: "Guntur" }).success).toBe(false);
    expect(registerSchema.safeParse({ role: "PATIENT", ...common, phone: "12345", gender: "Female", yearOfBirth: 1970, city: "Guntur" }).success).toBe(false);
    expect(registerSchema.safeParse({ role: "DOCTOR", ...common, city: "Hyderabad" }).success).toBe(false);
    expect(registerSchema.safeParse({ role: "PATIENT", ...common, gender: "Female", yearOfBirth: 1970, city: "Guntur", aadhaar: "1234" }).success).toBe(false);
  });
  it("blocks Aadhaar-like numbers in names", () => {
    expect(registerSchema.safeParse({ role: "PATIENT", ...common, fullName: "1234 5678 9012", gender: "Female", yearOfBirth: 1970, city: "Guntur" }).success).toBe(false);
  });
  it("assisted registration requires the patient's consent", () => {
    const base = { fullName: "Ramaiah", phone: "9123456780", gender: "Male", yearOfBirth: 1955, city: "Vijayawada", preferredLanguage: "te" };
    expect(assistedPatientSchema.safeParse({ ...base, consentConfirmed: true }).success).toBe(true);
    expect(assistedPatientSchema.safeParse({ ...base, consentConfirmed: false }).success).toBe(false);
  });
});

describe("clinical entries", () => {
  it("doctor notes and prescriptions validate", () => {
    expect(doctorNoteSchema.safeParse({ kind: "CONSULTATION", chiefComplaint: "Fever for 3 days", plan: ["Rest"] }).success).toBe(true);
    expect(doctorNoteSchema.safeParse({ kind: "PRESCRIPTION", medications: [] }).success).toBe(false);
  });
  it("ASHA visits need a reading or note, and both BP numbers", () => {
    expect(ashaVisitSchema.safeParse({ kind: "HOME_VISIT", systolic: 130, diastolic: 84 }).success).toBe(true);
    expect(ashaVisitSchema.safeParse({ kind: "HOME_VISIT" }).success).toBe(false);
    expect(ashaVisitSchema.safeParse({ kind: "HOME_VISIT", systolic: 130 }).success).toBe(false);
  });
  it("stored plain-language summaries exist in all three languages and only restate input", () => {
    const c = consultationExplain("Dr. A", new Date("2026-11-20"), "Cough", ["Steam inhalation"]);
    expect(c.en).toContain("Cough");
    expect(c.te).toContain("Cough");
    expect(c.hi).toContain("Steam inhalation");
    const h = homeVisitExplain("Padma", new Date("2026-11-20"), { bp: "130/84 mmHg" });
    expect(h.te).toContain("130/84");
    expect(h.en).toMatch(/not a diagnosis/);
  });
});
