// Shared domain constants, types and validation (safe for client + server).
import { z } from "zod";

export const LANGS = ["en", "hi", "te"] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_META: Record<Lang, { label: string; native: string; bcp47: string; short: string }> = {
  en: { label: "English", native: "English", bcp47: "en-IN", short: "EN" },
  hi: { label: "Hindi", native: "हिन्दी", bcp47: "hi-IN", short: "हिं" },
  te: { label: "Telugu", native: "తెలుగు", bcp47: "te-IN", short: "తె" },
};

export const ROLES = ["PATIENT", "DOCTOR", "ASHA"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABEL: Record<Role, string> = { PATIENT: "Patient", DOCTOR: "Doctor", ASHA: "ASHA worker" };

export const RECORD_TYPES = ["LAB_REPORT", "PRESCRIPTION", "CONSULTATION", "IMAGING", "PATIENT_NOTE", "HOME_VISIT"] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export const RECORD_TYPE_LABEL: Record<RecordType, string> = {
  LAB_REPORT: "Lab report",
  PRESCRIPTION: "Prescription",
  CONSULTATION: "Consultation",
  IMAGING: "Imaging",
  PATIENT_NOTE: "Patient-reported",
  HOME_VISIT: "ASHA home visit",
};

/** Human label for where a record came from. */
export function sourceLabel(r: { authorType: string; verificationStatus: string }): string {
  if (r.authorType === "PATIENT") return "Self-reported";
  if (r.authorType === "ASHA") return "Recorded by ASHA worker";
  if (r.authorType === "LABORATORY") return "Issued by laboratory";
  return "Written by doctor";
}

export const FACILITY_TYPES = ["HOSPITAL", "CLINIC", "PHC", "DIAGNOSTIC_LAB", "PHARMACY"] as const;
export type FacilityType = (typeof FACILITY_TYPES)[number];
export const FACILITY_TYPE_LABEL: Record<FacilityType, string> = {
  HOSPITAL: "Hospital",
  CLINIC: "Clinic",
  PHC: "Primary Health Centre",
  DIAGNOSTIC_LAB: "Diagnostic lab",
  PHARMACY: "Pharmacy",
};

export const TEXT_SCALES = ["normal", "large", "xlarge"] as const;
export type TextScale = (typeof TEXT_SCALES)[number];

export const DEPARTMENTS = [
  "General Medicine",
  "Cardiology",
  "Ophthalmology",
  "Orthopaedics",
  "Paediatrics",
  "Gynaecology",
  "Dermatology",
  "ENT",
  "Dental",
  "Diabetology",
] as const;
export type Department = (typeof DEPARTMENTS)[number];

/** Supported cities + localized names (used by UI, voice parsing and validation). */
export const CITIES = [
  { id: "Hyderabad", state: "Telangana", te: "హైదరాబాద్", hi: "हैदराबाद", aliases: ["hyderabad", "hyd", "హైదరాబాదు", "హైదరాబాద్", "हैदराबाद", "secunderabad"] },
  { id: "Visakhapatnam", state: "Andhra Pradesh", te: "విశాఖపట్నం", hi: "विशाखापत्तनम", aliases: ["visakhapatnam", "vishakhapatnam", "visakapatnam", "vizag", "visakha", "విశాఖపట్నం", "విశాఖ", "వైజాగ్", "विशाखापत्तनम", "विशाखापट्टनम", "विज़ाग", "वाइज़ैग"] },
  { id: "Vijayawada", state: "Andhra Pradesh", te: "విజయవాడ", hi: "विजयवाड़ा", aliases: ["vijayawada", "bezawada", "విజయవాడ", "बेजवाड़ा", "विजयवाड़ा", "विजयवाडा"] },
  { id: "Guntur", state: "Andhra Pradesh", te: "గుంటూరు", hi: "गुंटूर", aliases: ["guntur", "గుంటూరు", "गुंटूर"] },
  { id: "Warangal", state: "Telangana", te: "వరంగల్", hi: "वारंगल", aliases: ["warangal", "వరంగల్", "वारंगल"] },
  { id: "Tirupati", state: "Andhra Pradesh", te: "తిరుపతి", hi: "तिरुपति", aliases: ["tirupati", "tirupathi", "తిరుపతి", "तिरुपति"] },
  { id: "Delhi", state: "Delhi", te: "ఢిల్లీ", hi: "दिल्ली", aliases: ["new delhi", "delhi", "ఢిల్లీ", "దిల్లీ", "नई दिल्ली", "दिल्ली"] },
  { id: "Lucknow", state: "Uttar Pradesh", te: "లక్నో", hi: "लखनऊ", aliases: ["lucknow", "లక్నో", "लखनऊ"] },
  { id: "Varanasi", state: "Uttar Pradesh", te: "వారణాసి", hi: "वाराणसी", aliases: ["varanasi", "banaras", "benares", "వారణాసి", "वाराणसी", "बनारस"] },
  { id: "Chennai", state: "Tamil Nadu", te: "చెన్నై", hi: "चेन्नई", aliases: ["chennai", "madras", "చెన్నై", "चेन्नई"] },
  { id: "Bengaluru", state: "Karnataka", te: "బెంగళూరు", hi: "बेंगलुरु", aliases: ["bengaluru", "bangalore", "బెంగళూరు", "బెంగుళూరు", "बेंगलुरु", "बैंगलोर"] },
] as const;
export type CityId = (typeof CITIES)[number]["id"];
export const CITY_IDS = CITIES.map((c) => c.id) as [CityId, ...CityId[]];

export function cityName(id: string, lang: Lang): string {
  const c = CITIES.find((x) => x.id === id);
  if (!c || lang === "en") return id;
  return c[lang];
}

/** Fields that the voice assistant may change. Anything else is rejected. */
export const preferencePatchSchema = z
  .object({
    preferredLanguage: z.enum(LANGS),
    city: z.enum(CITY_IDS),
    textScale: z.enum(TEXT_SCALES),
    voiceResponses: z.boolean(),
    highContrast: z.boolean(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });
export type PreferencePatch = z.infer<typeof preferencePatchSchema>;

export const appointmentRequestSchema = z
  .object({
    facilityId: z.string().min(1).max(64),
    department: z.enum(DEPARTMENTS),
    preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    notes: z.string().max(300).optional(),
  })
  .strict();

/** Patterns for data the assistant must never enter, read aloud or store. */
export const SENSITIVE_PATTERNS: RegExp[] = [
  /\b(password|passcode|pass word|pin|otp|one[-\s]?time password|aadhaa?r|aadhar|cvv|abha (number|id|address)|abha no)\b/i,
  /(पासवर्ड|ओटीपी|आधार|पिन नंबर|पिन कोड नहीं)/,
  /(పాస్‌?వర్డ్|ఓటీపీ|ఓటిపి|ఆధార్|పిన్ నంబర్)/,
  /\b\d{4}\s?\d{4}\s?\d{4}\b/, // 12-digit Aadhaar-like number
];
export function containsSensitive(text: string): boolean {
  return SENSITIVE_PATTERNS.some((p) => p.test(text));
}

// ---------------------------------------------------------------------------
// Registration (shared by client forms and the API)
// ---------------------------------------------------------------------------
const noIdNumbers = (v: string) => !SENSITIVE_PATTERNS[3].test(v);
const name = z.string().trim().min(2, "Enter the full name").max(80).refine(noIdNumbers, "Do not enter ID numbers here");
export const phoneSchema = z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number");
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(100)
  .regex(/[A-Za-z]/, "Include a letter")
  .regex(/\d/, "Include a number");

const common = {
  fullName: name,
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(120),
  phone: phoneSchema,
  password: passwordSchema,
  preferredLanguage: z.enum(LANGS).default("en"),
};

export const registerSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("PATIENT"),
    ...common,
    gender: z.enum(["Female", "Male", "Other"]),
    yearOfBirth: z.coerce.number().int().min(1900).max(new Date().getFullYear()),
    city: z.enum(CITY_IDS),
  }).strict(),
  z.object({
    role: z.literal("DOCTOR"),
    ...common,
    registrationNumber: z.string().trim().regex(/^[A-Za-z0-9/.-]{4,30}$/, "Use letters, numbers, / or - (4–30 characters)"),
    specialization: z.string().trim().min(2).max(60),
    facilityName: z.string().trim().min(2).max(100),
    city: z.enum(CITY_IDS),
  }).strict(),
  z.object({
    role: z.literal("ASHA"),
    ...common,
    ashaId: z.string().trim().regex(/^[A-Za-z0-9/-]{4,30}$/, "Use letters, numbers, / or - (4–30 characters)"),
    village: z.string().trim().min(2).max(80),
    district: z.enum(CITY_IDS),
    phcName: z.string().trim().min(2).max(100),
  }).strict(),
]);
export type RegisterInput = z.infer<typeof registerSchema>;

/** ASHA-assisted registration of a patient (no email needed; signs in with mobile number). */
export const assistedPatientSchema = z
  .object({
    fullName: name,
    phone: phoneSchema,
    gender: z.enum(["Female", "Male", "Other"]),
    yearOfBirth: z.coerce.number().int().min(1900).max(new Date().getFullYear()),
    city: z.enum(CITY_IDS),
    preferredLanguage: z.enum(LANGS).default("te"),
    consentConfirmed: z.literal(true, { errorMap: () => ({ message: "The patient's consent is required" }) }),
  })
  .strict();

// Clinical entries by care roles
const shortText = (max: number) => z.string().trim().max(max).refine(noIdNumbers, "Do not enter ID numbers");
export const doctorNoteSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("CONSULTATION"),
    chiefComplaint: shortText(200).pipe(z.string().min(2, "Enter the reason for visit")),
    notes: shortText(1500).optional(),
    plan: z.array(shortText(200)).max(10).default([]),
    followUp: shortText(100).optional(),
  }).strict(),
  z.object({
    kind: z.literal("PRESCRIPTION"),
    medications: z
      .array(z.object({ name: shortText(80).pipe(z.string().min(2)), dose: shortText(40), frequency: shortText(80), duration: shortText(40) }).strict())
      .min(1, "Add at least one medicine")
      .max(15),
    notes: shortText(500).optional(),
  }).strict(),
]);
export const ashaVisitSchema = z
  .object({
    kind: z.literal("HOME_VISIT"),
    systolic: z.coerce.number().int().min(60).max(260).optional(),
    diastolic: z.coerce.number().int().min(30).max(160).optional(),
    weightKg: z.coerce.number().min(1).max(250).optional(),
    bloodSugar: z.coerce.number().int().min(20).max(700).optional(),
    notes: shortText(800).optional(),
  })
  .strict()
  .refine((v) => v.systolic || v.weightKg || v.bloodSugar || v.notes, { message: "Enter at least one reading or a note" })
  .refine((v) => (v.systolic === undefined) === (v.diastolic === undefined), { message: "Enter both BP numbers" });

export const APPOINTMENT_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Scheduled",
  REQUESTED: "Requested · not yet confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

// DTOs shared between server and client
export interface LabResultDTO {
  id: string;
  testCode: string;
  testName: string;
  value: number | null;
  valueText: string | null;
  unit: string;
  refLow: number | null;
  refHigh: number | null;
  refText: string | null;
}
export interface RecordSummaryDTO {
  id: string;
  recordType: RecordType;
  category: string;
  title: string;
  recordDate: string;
  facilityName: string;
  authorType: string;
  authorName: string;
  source: string;
  verificationStatus: string;
  summary: string;
  abnormalCount: number;
}
export interface RecordDetailDTO extends RecordSummaryDTO {
  details: Record<string, unknown>;
  labResults: LabResultDTO[];
}

export type RangeStatus = "low" | "high" | "normal" | "unknown";
export function rangeStatus(r: Pick<LabResultDTO, "value" | "refLow" | "refHigh">): RangeStatus {
  if (r.value == null) return "unknown";
  if (r.refLow != null && r.value < r.refLow) return "low";
  if (r.refHigh != null && r.value > r.refHigh) return "high";
  if (r.refLow == null && r.refHigh == null) return "unknown";
  return "normal";
}

export function formatDate(iso: string | Date, lang: Lang = "en"): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString(LANG_META[lang].bcp47, { day: "numeric", month: "short", year: "numeric" });
}
