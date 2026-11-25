// Deterministic, multilingual (English / Hindi / Telugu) intent recognition.
// Pure functions only — no DOM, no network — so it is fully unit-testable and
// safe to use for critical actions. An optional LLM may *propose* an intent for
// unknown utterances, but its output is validated against `intentSchema`.
import { z } from "zod";
import { CITIES, DEPARTMENTS, LANGS, TEXT_SCALES, containsSensitive, type CityId, type Lang } from "../domain";

export const INTENT_TYPES = [
  "NAVIGATE_DASHBOARD",
  "OPEN_HEALTH_RECORDS",
  "OPEN_SPECIFIC_REPORT",
  "EXPLAIN_REPORT",
  "OPEN_PROFILE",
  "UPDATE_FORM_FIELD",
  "SEARCH_FACILITIES",
  "OPEN_APPOINTMENTS",
  "SHOW_HELP",
  "SCROLL_PAGE",
  "GO_BACK",
  "CHANGE_LANGUAGE",
  "CANCEL_ACTION",
  // care-team roles (doctor / ASHA worker)
  "OPEN_PATIENTS",
  // safety + fallback
  "BLOCKED_SENSITIVE",
  "UNKNOWN",
] as const;
export type IntentType = (typeof INTENT_TYPES)[number];

export const RECORD_CATEGORIES = ["blood_test", "diabetes", "lipid", "thyroid", "consultation", "prescription", "chest_xray", "bp_log"] as const;
export type RecordCategory = (typeof RECORD_CATEGORIES)[number];

export const FORM_FIELDS = ["city", "preferredLanguage", "textScale", "voiceResponses", "department", "preferredDate"] as const;
export type FormField = (typeof FORM_FIELDS)[number];

export const intentSchema = z.object({
  type: z.enum(INTENT_TYPES),
  params: z
    .object({
      category: z.enum(RECORD_CATEGORIES).optional(),
      ordinal: z.union([z.literal("latest"), z.literal("oldest"), z.number().int().min(1).max(20)]).optional(),
      anaphora: z.boolean().optional(), // "it", "this one", "ఇది", "इसे"
      targetLang: z.enum(LANGS).optional(),
      field: z.enum(FORM_FIELDS).optional(),
      value: z.union([z.string().max(60), z.boolean()]).optional(),
      city: z.string().max(40).optional(),
      facilityType: z.enum(["HOSPITAL", "CLINIC", "PHC", "DIAGNOSTIC_LAB", "PHARMACY"]).optional(),
      booking: z.boolean().optional(),
      direction: z.enum(["up", "down", "top", "bottom"]).optional(),
      openHelpPage: z.boolean().optional(),
      reportsOnly: z.boolean().optional(), // "report" (lab/imaging) rather than any record
      register: z.boolean().optional(), // OPEN_PATIENTS: open the registration form
    })
    .strict()
    .default({}),
});
export type Intent = z.infer<typeof intentSchema>;

// ---------------------------------------------------------------------------
// Normalisation + matching helpers
// ---------------------------------------------------------------------------
export function normalize(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[​‌‍]/g, "") // zero-width joiners vary between STT engines
    .replace(/[.,!?;:"'“”‘’()\[\]{}।॥]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** English terms use word boundaries; Indic terms use substring match (agglutinative suffixes). */
function has(text: string, terms: readonly string[]): boolean {
  return terms.some((t) => {
    const term = t.replace(/[​‌‍]/g, "");
    if (/^[\x00-\x7f]+$/.test(term)) {
      const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(text);
    }
    return text.includes(term);
  });
}

// ---------------------------------------------------------------------------
// Lexicon
// ---------------------------------------------------------------------------
const L = {
  cancel: ["cancel", "stop that", "never mind", "nevermind", "forget it", "abort", "रद्द", "रहने दो", "छोड़ो", "कैंसल", "రద్దు", "వద్దు", "క్యాన్సిల్"],
  explain: ["explain", "what does", "what do", "meaning", "mean", "understand", "simple words", "समझाओ", "समझाइए", "समझा", "समझाएं", "समझाएँ", "मतलब", "బోధించు", "వివరించు", "వివరించండి", "వివరించు", "వివరణ", "అర్థం", "అర్ధం", "చెప్పు ఏంటి"],
  records: ["record", "records", "report", "reports", "health records", "medical records", "documents", "रिकॉर्ड", "रिकार्ड", "रिपोर्ट", "दस्तावेज़", "రికార్డ్", "రికార్డు", "రిపోర్ట్", "రిపోర్టు", "నివేదిక"],
  open: ["open", "show", "display", "view", "see", "go to", "take me", "bring up", "pull up", "load", "खोलो", "खोलें", "खोलिए", "दिखाओ", "दिखाइए", "दिखाएं", "दिखाएँ", "देखना", "ले चलो", "తెరువు", "తెరవండి", "చూపించు", "చూపించండి", "చూపు", "చూడాలి", "ఓపెన్"],
  latest: ["latest", "last", "most recent", "recent", "newest", "new one", "ताज़ा", "ताजा", "नवीनतम", "आख़िरी", "आखिरी", "लेटेस्ट", "सबसे नया", "నవీనమైన", "తాజా", "లేటెస్ట్", "చివరి", "కొత్త"],
  oldest: ["oldest", "earliest", "first one ever", "पुराना", "सबसे पुराना", "పాత", "పాతది"],
  anaphora: ["it", "this", "that", "this one", "that one", "this report", "the report", "इसे", "इस", "यह", "ये", "उसे", "ఇది", "దీన్ని", "దాన్ని", "ఈ రిపోర్ట్"],
  profile: ["profile", "preferences", "settings", "my details", "account", "प्रोफ़ाइल", "प्रोफाइल", "सेटिंग", "पसंद", "ప్రొఫైల్", "సెట్టింగ్", "సెట్టింగ్స్", "ప్రాధాన్యతలు"],
  dashboard: ["dashboard", "home", "home page", "main page", "डैशबोर्ड", "होम", "मुख्य पेज", "డాష్‌బోర్డ్", "డాష్బోర్డ్", "డ్యాష్‌బోర్డ్", "హోమ్", "ముఖ్య పేజీ"],
  appointments: ["appointment", "appointments", "booking", "book", "schedule", "visit", "अपॉइंटमेंट", "अपोइंटमेंट", "मुलाक़ात", "बुकिंग", "अप्वाइंटमेंट", "అపాయింట్‌మెంట్", "అపాయింట్మెంట్", "అపాయింట్‌మెంట్స్", "బుకింగ్"],
  booking: ["book", "booking", "new appointment", "request", "बुक", "बुकिंग", "नया अपॉइंटमेंट", "బుక్", "బుకింగ్", "కొత్త అపాయింట్"],
  facility: ["hospital", "hospitals", "clinic", "clinics", "facility", "facilities", "health centre", "health center", "phc", "pharmacy", "pharmacies", "lab", "labs", "diagnostic", "healthcare services", "health services", "services", "doctor near", "अस्पताल", "हॉस्पिटल", "क्लिनिक", "दवाखाना", "स्वास्थ्य केंद्र", "फार्मेसी", "दवा की दुकान", "లాబ్", "ఆసుపత్రి", "ఆసుపత్ర", "ఆస్పత్రి", "ఆస్పత్ర", "హాస్పిటల్", "హాస్పిటల్స్", "క్లినిక్", "దవాఖానా", "ఆరోగ్య కేంద్రం", "ఫార్మసీ", "మందుల షాపు", "ఆరోగ్య సేవలు"],
  find: ["find", "search", "look for", "near", "nearby", "near me", "in", "खोजो", "खोजें", "ढूंढो", "ढूँढो", "पास", "में", "వెతుకు", "వెతకండి", "దగ్గర", "లో"],
  help: ["help", "what can i do", "what can you do", "how do i", "guide", "commands", "मदद", "सहायता", "क्या कर सकता", "क्या कर सकती", "సహాయం", "హెల్ప్", "ఏమి చేయగలను", "ఏం చేయగలను", "ఏమి చేయగలవు"],
  helpPage: ["help page", "voice guide", "command guide", "open help", "मदद पेज", "సహాయ పేజీ"],
  scrollDown: ["scroll down", "down", "next", "below", "नीचे", "కిందకి", "క్రిందికి", "కిందికి"],
  scrollUp: ["scroll up", "up", "above", "ऊपर", "పైకి"],
  scrollTop: ["top", "to the top", "सबसे ऊपर", "పైభాగం"],
  scrollBottom: ["bottom", "to the bottom", "end of page", "सबसे नीचे", "చివరికి"],
  scroll: ["scroll", "स्क्रॉल", "స్క్రోల్"],
  back: ["go back", "back", "previous page", "पीछे", "वापस जाओ", "वापस", "వెనక్కి", "వెనుకకు", "వెనక్కు"],
  speakLang: ["speak", "talk", "switch", "change language", "language", "reply", "बोलो", "बात करो", "भाषा", "మాట్లాడు", "మాట్లాడండి", "భాష", "మార్చు"],
  set: ["set", "change", "update", "make", "put", "switch", "fill", "enter", "करो", "कर दो", "बदलो", "बदल दो", "सेट", "రాయి", "మార్చు", "మార్చండి", "సెట్", "పెట్టు", "చేయి"],
  cityWord: ["city", "location", "town", "शहर", "नगर", "నగరం", "ఊరు", "సిటీ", "పట్టణం"],
  prefLangWord: ["preferred language", "my language", "default language", "पसंदीदा भाषा", "मेरी भाषा", "ఇష్టమైన భాష", "నా భాష"],
  textSizeWord: ["text size", "font size", "font", "text", "letters", "words bigger", "अक्षर", "फ़ॉन्ट", "అక్షరాలు", "ఫాంట్", "అక్షర పరిమాణం"],
  voiceRespWord: ["voice responses", "voice replies", "speak responses", "आवाज़ में जवाब", "వాయిస్ సమాధానాలు"],
  departmentWord: ["department", "speciality", "specialty", "विभाग", "విభాగం", "డిపార్ట్‌మెంట్"],
  dateWord: ["date", "preferred date", "तारीख", "తేదీ"],
  patients: ["patients", "patient list", "my patients", "मरीज़", "मरीज", "मरीजों", "मरीज़ों", "रोगी", "రోగులు", "రోగుల", "రోగి", "పేషెంట్స్", "పేషెంట్ల", "పేషెంట్"],
  registerPatient: ["register", "registration", "new patient", "add patient", "enroll", "enrol", "रजिस्टर", "नया मरीज़", "नया मरीज", "नए मरीज", "पंजीकरण", "నమోదు", "రిజిస్టర్", "కొత్త రోగి", "కొత్త పేషెంట్"],
};

const LANG_WORDS: Record<Lang, string[]> = {
  en: ["english", "अंग्रेज़ी", "अंग्रेजी", "इंग्लिश", "ఇంగ్లీష్", "ఆంగ్లం", "ఇంగ్లిష్"],
  hi: ["hindi", "हिंदी", "हिन्दी", "హిందీ"],
  te: ["telugu", "तेलुगु", "तेलगु", "తెలుగు", "తెలుగులో"],
};

const CATEGORY_TERMS: Record<RecordCategory, string[]> = {
  blood_test: ["blood test", "blood report", "cbc", "complete blood count", "hemoglobin", "haemoglobin", "ब्लड टेस्ट", "खून की जांच", "खून की जाँच", "रक्त जांच", "सीबीसी", "బ్లడ్ టెస్ట్", "రక్త పరీక్ష", "రక్తపరీక్ష", "హిమోగ్లోబిన్"],
  diabetes: ["sugar", "glucose", "diabetes", "hba1c", "शुगर", "डायबिटीज़", "डायबिटीज", "मधुमेह", "షుగర్", "చక్కెర", "మధుమేహం", "డయాబెటిస్"],
  lipid: ["lipid", "cholesterol", "ldl", "hdl", "triglyceride", "कोलेस्ट्रॉल", "कोलेस्ट्रोल", "लिपिड", "కొలెస్ట్రాల్", "లిపిడ్"],
  thyroid: ["thyroid", "tsh", "थायरॉइड", "थायराइड", "థైరాయిడ్"],
  consultation: ["consultation", "doctor visit", "visit summary", "doctor's note", "परामर्श", "डॉक्टर की पर्ची", "కన్సల్టేషన్", "డాక్టర్ సందర్శన"],
  prescription: ["prescription", "medicines", "medicine", "medication", "tablets", "प्रिस्क्रिप्शन", "पर्चा", "दवा", "दवाई", "దవాఖానా మందు", "ప్రిస్క్రిప్షన్", "మందులు", "మందు"],
  chest_xray: ["x-ray", "xray", "x ray", "chest", "एक्स-रे", "एक्सरे", "एक्स रे", "ఎక్స్-రే", "ఎక్స్‌రే", "ఎక్స్ రే", "ఛాతీ"],
  bp_log: ["blood pressure", "bp", "बीपी", "ब्लड प्रेशर", "రక్తపోటు", "బీపీ"],
};

const FACILITY_TYPE_TERMS: Record<NonNullable<Intent["params"]["facilityType"]>, string[]> = {
  HOSPITAL: ["hospital", "hospitals", "अस्पताल", "हॉस्पिटल", "ఆసుపత్రి", "ఆసుపత్ర", "ఆస్పత్రి", "ఆస్పత్ర", "హాస్పిటల్"],
  CLINIC: ["clinic", "clinics", "क्लिनिक", "दवाखाना", "క్లినిక్", "దవాఖానా"],
  PHC: ["phc", "primary health", "health centre", "health center", "स्वास्थ्य केंद्र", "ఆరోగ్య కేంద్రం"],
  DIAGNOSTIC_LAB: ["lab", "labs", "diagnostic", "laboratory", "लैब", "जांच केंद्र", "ల్యాబ్", "లాబ్"],
  PHARMACY: ["pharmacy", "pharmacies", "chemist", "medical store", "फार्मेसी", "दवा की दुकान", "ఫార్మసీ", "మందుల షాపు"],
};

const ORDINALS: { n: number; terms: string[] }[] = [
  { n: 1, terms: ["first", "1st", "number one", "पहला", "पहली", "पहले वाला", "మొదటి", "మొదటిది", "ఒకటి", "ఫస్ట్"] },
  { n: 2, terms: ["second", "2nd", "two", "number two", "दूसरा", "दूसरी", "రెండవ", "రెండవది", "రెండో", "రెండు", "సెకండ్"] },
  { n: 3, terms: ["third", "3rd", "three", "number three", "तीसरा", "तीसरी", "మూడవ", "మూడవది", "మూడో", "మూడు"] },
  { n: 4, terms: ["fourth", "4th", "four", "चौथा", "चौथी", "నాలుగవ", "నాలుగు"] },
];

const TEXT_SCALE_TERMS: Record<(typeof TEXT_SCALES)[number], string[]> = {
  xlarge: ["extra large", "very large", "very big", "largest", "बहुत बड़ा", "బాగా పెద్ద", "చాలా పెద్ద"],
  large: ["large", "big", "bigger", "larger", "बड़ा", "बड़े", "పెద్ద"],
  normal: ["normal", "small", "smaller", "default", "regular", "सामान्य", "छोटा", "సాధారణ", "చిన్న"],
};

const DEPARTMENT_TERMS: Record<(typeof DEPARTMENTS)[number], string[]> = {
  "General Medicine": ["general medicine", "general physician", "जनरल", "సాధారణ వైద్యం", "జనరల్ మెడిసిన్"],
  Cardiology: ["cardiology", "heart", "cardiac", "हृदय", "दिल", "కార్డియాలజీ", "గుండె"],
  Ophthalmology: ["ophthalmology", "eye", "eyes", "आँख", "आंख", "नेत्र", "కంటి", "కళ్ళు", "కన్ను"],
  Orthopaedics: ["orthopaedics", "orthopedics", "ortho", "bone", "bones", "हड्डी", "ఎముక", "ఆర్థోపెడిక్"],
  Paediatrics: ["paediatrics", "pediatrics", "child", "children", "बच्चों", "పిల్లల"],
  Gynaecology: ["gynaecology", "gynecology", "women", "स्त्री रोग", "గైనకాలజీ", "స్త్రీ వైద్య"],
  Dermatology: ["dermatology", "skin", "त्वचा", "చర్మ"],
  ENT: ["ent", "ear nose throat", "ear", "कान", "చెవి"],
  Dental: ["dental", "dentist", "teeth", "tooth", "दांत", "दाँत", "పళ్ళు", "దంత"],
  Diabetology: ["diabetology", "diabetes clinic", "मधुमेह विभाग", "మధుమేహ విభాగం"],
};

export function findCity(text: string): CityId | undefined {
  const t = normalize(text);
  // Longest alias first so "new delhi" beats "delhi"
  const all = CITIES.flatMap((c) => c.aliases.map((a) => ({ id: c.id, a: normalize(a) }))).sort((x, y) => y.a.length - x.a.length);
  return all.find(({ a }) => has(t, [a]))?.id;
}

export function findLanguageMention(text: string): Lang | undefined {
  const t = normalize(text);
  return (Object.keys(LANG_WORDS) as Lang[]).find((l) => has(t, LANG_WORDS[l]));
}

export function findCategory(t: string): RecordCategory | undefined {
  // Order matters: "blood pressure" must not be read as "blood test"
  const order: RecordCategory[] = ["bp_log", "diabetes", "lipid", "thyroid", "chest_xray", "prescription", "consultation", "blood_test"];
  return order.find((c) => has(t, CATEGORY_TERMS[c]));
}

export function findOrdinal(t: string): "latest" | "oldest" | number | undefined {
  if (has(t, L.latest)) return "latest";
  if (has(t, L.oldest)) return "oldest";
  for (const o of ORDINALS) if (has(t, o.terms)) return o.n;
  return undefined;
}

function findFacilityType(t: string) {
  return (Object.keys(FACILITY_TYPE_TERMS) as (keyof typeof FACILITY_TYPE_TERMS)[]).find((k) => has(t, FACILITY_TYPE_TERMS[k]));
}

function findDepartment(t: string) {
  return (Object.keys(DEPARTMENT_TERMS) as (keyof typeof DEPARTMENT_TERMS)[]).find((k) => has(t, DEPARTMENT_TERMS[k]));
}

function findDate(t: string): string | undefined {
  const iso = t.match(/\b(20\d\d)-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];
  const today = new Date();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (has(t, ["day after tomorrow", "परसों", "ఎల్లుండి"])) return fmt(new Date(today.getTime() + 2 * 864e5));
  if (has(t, ["tomorrow", "कल", "రేపు"])) return fmt(new Date(today.getTime() + 864e5));
  return undefined;
}

// ---------------------------------------------------------------------------
// Confirmation / choice parsing (used when the assistant is waiting)
// ---------------------------------------------------------------------------
const YES = ["yes", "yeah", "yep", "yup", "sure", "ok", "okay", "confirm", "go ahead", "do it", "correct", "right", "हाँ", "हां", "हा", "जी हाँ", "जी", "ठीक है", "कर दो", "पक्का", "అవును", "ఔను", "సరే", "ఓకే", "చేయి", "చేయండి", "కానివ్వు", "హా"];
const NO = ["no", "nope", "don't", "do not", "not now", "नहीं", "नही", "मत करो", "కాదు", "వద్దు", "లేదు", "చేయకు", "నో"];

export function parseConfirmation(text: string): "yes" | "no" | null {
  const t = normalize(text);
  const n = has(t, NO);
  const y = has(t, YES);
  if (n && !y) return "no";
  if (y && !n) return "yes";
  // "no, don't" / mixed -> treat as NO for safety
  if (y && n) return "no";
  return null;
}

/** Interprets "first", "the second one", "2", "రెండవది", "latest" against a list of n options. */
export function parseChoice(text: string, n: number): number | null {
  const t = normalize(text);
  const digit = t.match(/\b([1-9])\b/);
  if (digit) {
    const i = Number(digit[1]);
    return i >= 1 && i <= n ? i - 1 : null;
  }
  if (has(t, L.latest)) return 0; // options are presented newest first
  if (has(t, L.oldest)) return n - 1;
  for (const o of ORDINALS) if (has(t, o.terms) && o.n <= n) return o.n - 1;
  return null;
}

// ---------------------------------------------------------------------------
// Main recogniser
// ---------------------------------------------------------------------------
export interface RecognizeContext {
  /** Records currently shown on screen (newest first) — enables "open the latest one". */
  hasVisibleRecords?: boolean;
  /** A record is selected/open — enables "explain it". */
  hasSelectedRecord?: boolean;
  /** Which voice-fillable form is on screen, if any. */
  activeForm?: "preferences" | "appointment-request" | null;
  /** Care-team list on screen — enables "open the first patient". */
  hasVisiblePatients?: boolean;
}

/** "latest report" means a lab/imaging report, while "latest record"/"latest one" means anything. */
function reportsOnly(t: string): boolean {
  return has(t, ["report", "reports", "रिपोर्ट", "రిపోర్ట్", "రిపోర్టు", "నివేదిక"]) && !has(t, ["record", "records", "रिकॉर्ड", "రికార్డ్"]);
}

const mk = (type: IntentType, params: Intent["params"] = {}): Intent => ({ type, params });

export function recognize(raw: string, ctx: RecognizeContext = {}): Intent {
  const t = normalize(raw);
  if (!t) return mk("UNKNOWN");

  // 0. Safety first: never handle credentials / national IDs.
  if (containsSensitive(raw)) return mk("BLOCKED_SENSITIVE");

  // 1. Cancel
  if (has(t, L.cancel) && t.split(" ").length <= 5) return mk("CANCEL_ACTION");

  const category = findCategory(t);
  const ordinal = findOrdinal(t);
  const langMention = findLanguageMention(t);
  const city = findCity(t);
  const anaphora = has(t, L.anaphora);

  // 2. Explain (before language-change, so "explain it in Telugu" is not a language switch)
  if (has(t, L.explain)) {
    return mk("EXPLAIN_REPORT", { category, ordinal, anaphora: anaphora || (!category && !ordinal), targetLang: langMention, reportsOnly: reportsOnly(t) || undefined });
  }

  // 3. Form fields: "set my city to X", "change preferred language to Hindi", "make text bigger"
  const wantsSet = has(t, L.set);
  if (has(t, L.prefLangWord) && langMention) return mk("UPDATE_FORM_FIELD", { field: "preferredLanguage", value: langMention });
  if (has(t, L.cityWord) && city && (wantsSet || ctx.activeForm === "preferences")) return mk("UPDATE_FORM_FIELD", { field: "city", value: city });
  if (has(t, L.textSizeWord)) {
    const scale = (Object.keys(TEXT_SCALE_TERMS) as (keyof typeof TEXT_SCALE_TERMS)[]).find((k) => has(t, TEXT_SCALE_TERMS[k]));
    if (scale) return mk("UPDATE_FORM_FIELD", { field: "textScale", value: scale });
  }
  if (has(t, L.voiceRespWord)) {
    const off = has(t, ["off", "disable", "stop", "बंद", "ఆపు", "ఆఫ్"]);
    return mk("UPDATE_FORM_FIELD", { field: "voiceResponses", value: !off });
  }
  if (ctx.activeForm === "appointment-request") {
    const dept = findDepartment(t);
    if (dept && (wantsSet || has(t, L.departmentWord))) return mk("UPDATE_FORM_FIELD", { field: "department", value: dept });
    const date = findDate(t);
    if (date && (wantsSet || has(t, L.dateWord))) return mk("UPDATE_FORM_FIELD", { field: "preferredDate", value: date });
  }

  // 4. Language switch for the conversation
  if (langMention && (has(t, L.speakLang) || t.split(" ").length <= 2)) return mk("CHANGE_LANGUAGE", { targetLang: langMention });

  // 4b. Care-team: patient list / assisted registration
  const englishRegister = has(t, ["register", "enroll", "enrol", "add", "new"]) && has(t, ["patient"]);
  if ((has(t, L.patients) || englishRegister) && !category && !has(t, L.explain)) {
    return mk("OPEN_PATIENTS", { register: has(t, L.registerPatient) || undefined, ordinal: ctx.hasVisiblePatients ? ordinal : undefined });
  }

  // 5. Facilities / services
  const facilityType = findFacilityType(t);
  const mentionsRecords = has(t, L.records);
  const strongFacilitySearch =
    has(t, ["find", "search", "near", "nearby", "near me", "खोजो", "खोजें", "ढूंढो", "ढूँढो", "पास", "వెతుకు", "వెతకండి", "దగ్గర"]) &&
    facilityType !== undefined && facilityType !== "DIAGNOSTIC_LAB";
  if (has(t, L.facility) && !has(t, L.appointments) && (!(mentionsRecords || category) || strongFacilitySearch)) {
    return mk("SEARCH_FACILITIES", { city, facilityType });
  }

  // 6. Appointments
  if (has(t, L.appointments)) {
    return mk("OPEN_APPOINTMENTS", { booking: has(t, L.booking) });
  }

  // 7. Specific record ("open my latest blood test", "open the latest one", "open the second")
  if (category || ((ordinal !== undefined) && (mentionsRecords || ctx.hasVisibleRecords || has(t, ["one", "वाला", "वाली", "वाले"])))) {
    return mk("OPEN_SPECIFIC_REPORT", { category, ordinal, reportsOnly: reportsOnly(t) || undefined });
  }
  if (mentionsRecords && anaphora && ctx.hasSelectedRecord && has(t, L.open)) return mk("OPEN_SPECIFIC_REPORT", { anaphora: true });

  // 8. Records list
  if (mentionsRecords) return mk("OPEN_HEALTH_RECORDS");

  // 9. Profile / dashboard
  if (has(t, L.profile)) return mk("OPEN_PROFILE");
  if (has(t, L.dashboard)) return mk("NAVIGATE_DASHBOARD");

  // 10. Help
  if (has(t, L.help)) return mk("SHOW_HELP", { openHelpPage: has(t, L.helpPage) });

  // 11. Scroll / back
  if (has(t, L.scroll) || (t.split(" ").length <= 3 && (has(t, L.scrollDown) || has(t, L.scrollUp)))) {
    const direction = has(t, L.scrollTop) ? "top" : has(t, L.scrollBottom) ? "bottom" : has(t, L.scrollUp) ? "up" : "down";
    return mk("SCROLL_PAGE", { direction });
  }
  if (has(t, L.back)) return mk("GO_BACK");

  return mk("UNKNOWN");
}
