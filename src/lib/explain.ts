// Deterministic, grounded report explanations in English / Hindi / Telugu.
// Uses ONLY the values and reference ranges printed on the (synthetic) report.
// Never diagnoses, never recommends treatment.
import { formatDate, rangeStatus, type Lang, type LabResultDTO, type RecordDetailDTO } from "./domain";

interface Term { name: Record<Lang, string>; meaning: Record<Lang, string> }

export const GLOSSARY: Record<string, Term> = {
  HGB: {
    name: { en: "Haemoglobin", hi: "हीमोग्लोबिन", te: "హిమోగ్లోబిన్" },
    meaning: {
      en: "a protein in red blood cells that carries oxygen around the body",
      hi: "लाल रक्त कोशिकाओं में एक प्रोटीन जो शरीर में ऑक्सीजन पहुँचाता है",
      te: "ఎర్ర రక్త కణాలలో ఉండే ప్రోటీన్, ఇది శరీరమంతా ఆక్సిజన్‌ను తీసుకువెళ్తుంది",
    },
  },
  RBC: {
    name: { en: "Red blood cell count", hi: "लाल रक्त कोशिका गिनती", te: "ఎర్ర రక్త కణాల సంఖ్య" },
    meaning: { en: "how many red blood cells are in a small amount of blood", hi: "खून की थोड़ी मात्रा में कितनी लाल रक्त कोशिकाएँ हैं", te: "కొద్దిపాటి రక్తంలో ఎన్ని ఎర్ర రక్త కణాలు ఉన్నాయో" },
  },
  MCV: {
    name: { en: "MCV (average red cell size)", hi: "MCV (लाल कोशिका का औसत आकार)", te: "MCV (ఎర్ర కణాల సగటు పరిమాణం)" },
    meaning: { en: "the average size of your red blood cells", hi: "आपकी लाल रक्त कोशिकाओं का औसत आकार", te: "మీ ఎర్ర రక్త కణాల సగటు పరిమాణం" },
  },
  WBC: {
    name: { en: "White blood cell count", hi: "सफ़ेद रक्त कोशिका गिनती", te: "తెల్ల రక్త కణాల సంఖ్య" },
    meaning: { en: "cells that help the body fight infections", hi: "कोशिकाएँ जो शरीर को संक्रमण से लड़ने में मदद करती हैं", te: "శరీరం ఇన్ఫెక్షన్‌లతో పోరాడటానికి సహాయపడే కణాలు" },
  },
  PLT: {
    name: { en: "Platelet count", hi: "प्लेटलेट गिनती", te: "ప్లేట్‌లెట్ల సంఖ్య" },
    meaning: { en: "tiny cells that help blood to clot", hi: "छोटी कोशिकाएँ जो खून को जमने में मदद करती हैं", te: "రక్తం గడ్డకట్టడానికి సహాయపడే చిన్న కణాలు" },
  },
  FBS: {
    name: { en: "Fasting blood glucose", hi: "खाली पेट ब्लड शुगर", te: "పరగడుపున రక్తంలో చక్కెర" },
    meaning: { en: "the sugar level in your blood after not eating overnight", hi: "रात भर कुछ न खाने के बाद खून में शुगर का स्तर", te: "రాత్రంతా ఏమీ తినకుండా ఉన్న తర్వాత రక్తంలో చక్కెర స్థాయి" },
  },
  HBA1C: {
    name: { en: "HbA1c", hi: "HbA1c", te: "HbA1c" },
    meaning: {
      en: "an estimate of your average blood sugar over the last 2–3 months",
      hi: "पिछले 2–3 महीनों के औसत ब्लड शुगर का अनुमान",
      te: "గత 2–3 నెలల సగటు రక్తంలో చక్కెర స్థాయి అంచనా",
    },
  },
  TCHOL: {
    name: { en: "Total cholesterol", hi: "कुल कोलेस्ट्रॉल", te: "మొత్తం కొలెస్ట్రాల్" },
    meaning: { en: "the total amount of a fatty substance called cholesterol in your blood", hi: "खून में कोलेस्ट्रॉल नाम के वसा जैसे पदार्थ की कुल मात्रा", te: "రక్తంలో కొలెస్ట్రాల్ అనే కొవ్వు పదార్థం మొత్తం పరిమాణం" },
  },
  LDL: {
    name: { en: "LDL cholesterol", hi: "LDL कोलेस्ट्रॉल", te: "LDL కొలెస్ట్రాల్" },
    meaning: { en: "often called ‘bad’ cholesterol", hi: "जिसे अक्सर ‘ख़राब’ कोलेस्ट्रॉल कहा जाता है", te: "దీన్ని తరచుగా ‘చెడు’ కొలెస్ట్రాల్ అంటారు" },
  },
  HDL: {
    name: { en: "HDL cholesterol", hi: "HDL कोलेस्ट्रॉल", te: "HDL కొలెస్ట్రాల్" },
    meaning: { en: "often called ‘good’ cholesterol", hi: "जिसे अक्सर ‘अच्छा’ कोलेस्ट्रॉल कहा जाता है", te: "దీన్ని తరచుగా ‘మంచి’ కొలెస్ట్రాల్ అంటారు" },
  },
  TG: {
    name: { en: "Triglycerides", hi: "ट्राइग्लिसराइड्स", te: "ట్రైగ్లిజరైడ్స్" },
    meaning: { en: "a type of fat in the blood", hi: "खून में एक प्रकार की वसा", te: "రక్తంలో ఉండే ఒక రకమైన కొవ్వు" },
  },
  TSH: {
    name: { en: "TSH (thyroid stimulating hormone)", hi: "TSH (थायरॉइड हार्मोन)", te: "TSH (థైరాయిడ్ హార్మోన్)" },
    meaning: { en: "a hormone that tells the thyroid gland how much to work", hi: "एक हार्मोन जो थायरॉइड ग्रंथि को बताता है कि कितना काम करना है", te: "థైరాయిడ్ గ్రంథి ఎంత పని చేయాలో చెప్పే హార్మోన్" },
  },
  FT4: {
    name: { en: "Free T4", hi: "फ्री T4", te: "ఫ్రీ T4" },
    meaning: { en: "a hormone made by the thyroid gland", hi: "थायरॉइड ग्रंथि द्वारा बनाया गया हार्मोन", te: "థైరాయిడ్ గ్రంథి తయారు చేసే హార్మోన్" },
  },
};

const STATUS: Record<"low" | "high" | "normal" | "unknown", Record<Lang, string>> = {
  low: { en: "below the lab's reference range", hi: "लैब की संदर्भ सीमा से कम", te: "ల్యాబ్ ఇచ్చిన రిఫరెన్స్ పరిధి కంటే తక్కువ" },
  high: { en: "above the lab's reference range", hi: "लैब की संदर्भ सीमा से ज़्यादा", te: "ల్యాబ్ ఇచ్చిన రిఫరెన్స్ పరిధి కంటే ఎక్కువ" },
  normal: { en: "within the lab's reference range", hi: "लैब की संदर्भ सीमा के भीतर", te: "ల్యాబ్ ఇచ్చిన రిఫరెన్స్ పరిధిలోనే" },
  unknown: { en: "not compared, because the lab gave no reference range", hi: "तुलना नहीं की गई, क्योंकि लैब ने संदर्भ सीमा नहीं दी", te: "పోల్చలేదు, ఎందుకంటే ల్యాబ్ రిఫరెన్స్ పరిధి ఇవ్వలేదు" },
};

const T = {
  intro: {
    en: "This is your {title} from {date}, from {facility}.",
    hi: "यह {date} की आपकी {title} है, {facility} से।",
    te: "ఇది {date} నాటి మీ {title}, {facility} నుండి.",
  },
  valueLine: {
    en: "{name}: {value} {unit}. Reference range printed by the lab: {range}. This is {status}.",
    hi: "{name}: {value} {unit}। लैब द्वारा दी गई संदर्भ सीमा: {range}। यह {status} है।",
    te: "{name}: {value} {unit}. ల్యాబ్ ఇచ్చిన రిఫరెన్స్ పరిధి: {range}. ఇది {status} ఉంది.",
  },
  meaning: { en: "{name} is {meaning}.", hi: "{name} — {meaning}।", te: "{name} అంటే {meaning}." },
  flaggedSome: {
    en: "{k} of {n} values are outside the lab's reference range: {list}.",
    hi: "{n} में से {k} मान लैब की संदर्भ सीमा से बाहर हैं: {list}।",
    te: "{n} విలువలలో {k} ల్యాబ్ రిఫరెన్స్ పరిధికి బయట ఉన్నాయి: {list}.",
  },
  flaggedNone: {
    en: "All {n} values are within the lab's reference range.",
    hi: "सभी {n} मान लैब की संदर्भ सीमा के भीतर हैं।",
    te: "మొత్తం {n} విలువలు ల్యాబ్ రిఫరెన్స్ పరిధిలోనే ఉన్నాయి.",
  },
  caution: {
    en: "A value outside a reference range does not always mean a problem — it depends on your age, health history and other tests. This is educational information, not a diagnosis or treatment advice. Please discuss this report with a qualified doctor.",
    hi: "किसी मान का संदर्भ सीमा से बाहर होना हमेशा समस्या नहीं होता — यह आपकी उम्र, स्वास्थ्य इतिहास और दूसरी जाँचों पर निर्भर करता है। यह केवल जानकारी के लिए है, निदान या इलाज की सलाह नहीं। कृपया इस रिपोर्ट पर किसी योग्य डॉक्टर से बात करें।",
    te: "ఒక విలువ రిఫరెన్స్ పరిధికి బయట ఉన్నంత మాత్రాన ఎప్పుడూ సమస్య అని అర్థం కాదు — ఇది మీ వయస్సు, ఆరోగ్య చరిత్ర మరియు ఇతర పరీక్షలపై ఆధారపడి ఉంటుంది. ఇది అవగాహన కోసం మాత్రమే, రోగనిర్ధారణ లేదా చికిత్స సలహా కాదు. దయచేసి ఈ రిపోర్ట్ గురించి అర్హత కలిగిన డాక్టర్‌తో మాట్లాడండి.",
  },
  medCaution: {
    en: "Medicines listed: {list}.",
    hi: "लिखी गई दवाइयाँ: {list}।",
    te: "రాసిన మందులు: {list}.",
  },
  patientEntered: {
    en: "Note: this record was entered by you and is not verified by a clinician.",
    hi: "ध्यान दें: यह रिकॉर्ड आपने ख़ुद दर्ज किया है और किसी डॉक्टर ने इसकी पुष्टि नहीं की है।",
    te: "గమనిక: ఈ రికార్డ్‌ను మీరే నమోదు చేశారు, దీన్ని ఏ డాక్టర్ ధృవీకరించలేదు.",
  },
  noExplain: {
    en: "I don't have a simple-language explanation for this record type yet. Please ask your doctor about it.",
    hi: "इस प्रकार के रिकॉर्ड के लिए अभी आसान भाषा में व्याख्या उपलब्ध नहीं है। कृपया अपने डॉक्टर से पूछें।",
    te: "ఈ రకమైన రికార్డ్‌కు సులభమైన భాషలో వివరణ ఇంకా లేదు. దయచేసి మీ డాక్టర్‌ను అడగండి.",
  },
};

function fill(tpl: string, vars: Record<string, string | number>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? "")).replace(/\s+([।.,])/g, "$1");
}

function fmtNum(n: number) {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

export function formatRange(l: Pick<LabResultDTO, "refLow" | "refHigh" | "refText" | "unit">): string {
  if (l.refText) return l.refText;
  if (l.refLow != null && l.refHigh != null) return `${fmtNum(l.refLow)}–${fmtNum(l.refHigh)} ${l.unit}`;
  if (l.refLow != null) return `≥ ${fmtNum(l.refLow)} ${l.unit}`;
  if (l.refHigh != null) return `≤ ${fmtNum(l.refHigh)} ${l.unit}`;
  return "—";
}

const TITLE_LOCAL: Record<string, Record<Lang, string>> = {
  blood_test: { en: "blood test report (CBC)", hi: "ब्लड टेस्ट रिपोर्ट (CBC)", te: "బ్లడ్ టెస్ట్ రిపోర్ట్ (CBC)" },
  diabetes: { en: "blood sugar report", hi: "ब्लड शुगर रिपोर्ट", te: "బ్లడ్ షుగర్ రిపోర్ట్" },
  lipid: { en: "cholesterol (lipid) report", hi: "कोलेस्ट्रॉल (लिपिड) रिपोर्ट", te: "కొలెస్ట్రాల్ (లిపిడ్) రిపోర్ట్" },
  thyroid: { en: "thyroid report", hi: "थायरॉइड रिपोर्ट", te: "థైరాయిడ్ రిపోర్ట్" },
  consultation: { en: "consultation summary", hi: "परामर्श सारांश", te: "కన్సల్టేషన్ సారాంశం" },
  prescription: { en: "prescription", hi: "प्रिस्क्रिप्शन", te: "ప్రిస్క్రిప్షన్" },
  chest_xray: { en: "chest X-ray report", hi: "छाती के एक्स-रे की रिपोर्ट", te: "ఛాతీ ఎక్స్-రే రిపోర్ట్" },
  bp_log: { en: "home blood pressure log", hi: "घर का ब्लड प्रेशर लॉग", te: "ఇంటి బీపీ లాగ్" },
  home_visit: { en: "ASHA home visit note", hi: "आशा घर-मुलाक़ात नोट", te: "ఆశా ఇంటి సందర్శన నోట్" },
};

export interface ExplanationItem {
  testCode: string;
  name: string;
  valueDisplay: string;
  rangeDisplay: string;
  status: "low" | "high" | "normal" | "unknown";
  line: string;
  meaning?: string;
}
export interface Explanation {
  recordId: string;
  lang: Lang;
  mode: "deterministic" | "llm";
  intro: string;
  items: ExplanationItem[];
  summary: string;
  caution: string;
  /** Short version suitable for speech synthesis */
  spoken: string;
}

export function explainRecord(record: RecordDetailDTO, lang: Lang): Explanation {
  const title = TITLE_LOCAL[record.category]?.[lang] ?? record.title;
  const intro = fill(T.intro[lang], { title, date: formatDate(record.recordDate, lang), facility: record.facilityName });
  const caution = T.caution[lang];

  if (record.labResults.length > 0) {
    const items: ExplanationItem[] = record.labResults.map((l) => {
      const g = GLOSSARY[l.testCode];
      const name = g?.name[lang] ?? l.testName;
      const status = rangeStatus(l);
      const valueDisplay = l.value != null ? fmtNum(l.value) : l.valueText ?? "—";
      const rangeDisplay = formatRange(l);
      return {
        testCode: l.testCode,
        name,
        valueDisplay: `${valueDisplay} ${l.unit}`,
        rangeDisplay,
        status,
        line: fill(T.valueLine[lang], { name, value: valueDisplay, unit: l.unit, range: rangeDisplay, status: STATUS[status][lang] }),
        meaning: g ? fill(T.meaning[lang], { name, meaning: g.meaning[lang] }) : undefined,
      };
    });
    const flagged = items.filter((i) => i.status === "low" || i.status === "high");
    const summary = flagged.length
      ? fill(T.flaggedSome[lang], { k: flagged.length, n: items.length, list: flagged.map((f) => `${f.name} (${STATUS[f.status][lang]})`).join(lang === "en" ? "; " : "; ") })
      : fill(T.flaggedNone[lang], { n: items.length });
    return { recordId: record.id, lang, mode: "deterministic", intro, items, summary, caution, spoken: [intro, summary, caution].join(" ") };
  }

  // Non-lab records: use the localised plain-language summary stored with the record.
  const ex = (record.details?.explain ?? {}) as Partial<Record<Lang, string>>;
  const parts: string[] = [];
  if (ex[lang]) parts.push(ex[lang]!);
  const meds = Array.isArray(record.details?.medications) ? (record.details.medications as { name: string; frequency: string }[]) : [];
  if (meds.length) parts.push(fill(T.medCaution[lang], { list: meds.map((m) => `${m.name} — ${m.frequency}`).join("; ") }));
  if (record.authorType === "PATIENT") parts.push(T.patientEntered[lang]);
  const summary = parts.length ? parts.join(" ") : T.noExplain[lang];
  return { recordId: record.id, lang, mode: "deterministic", intro, items: [], summary, caution, spoken: [intro, ex[lang] ?? summary, caution].join(" ") };
}
