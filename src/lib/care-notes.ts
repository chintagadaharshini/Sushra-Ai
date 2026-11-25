// Builds stored, plain-language (te/hi/en) summaries for notes entered by doctors / ASHA workers,
// so patients can have them explained by voice. Only restates what was entered.
import { formatDate, type Lang } from "./domain";

type Med = { name: string; dose: string; frequency: string; duration: string };

export function consultationExplain(doctor: string, date: Date, complaint: string, plan: string[], followUp?: string): Record<Lang, string> {
  const d = (l: Lang) => formatDate(date, l);
  const p = plan.length ? plan.join("; ") : "";
  return {
    en: `This is a consultation note written by ${doctor} on ${d("en")}. Reason for the visit: ${complaint}.${p ? ` The doctor's plan: ${p}.` : ""}${followUp ? ` Follow-up: ${followUp}.` : ""} Ask your doctor if anything is unclear.`,
    hi: `यह ${d("hi")} को ${doctor} द्वारा लिखा गया परामर्श नोट है। मुलाक़ात का कारण: ${complaint}।${p ? ` डॉक्टर की योजना (जैसा लिखा है): ${p}।` : ""}${followUp ? ` दोबारा मिलना: ${followUp}।` : ""} कुछ समझ न आए तो अपने डॉक्टर से पूछें।`,
    te: `ఇది ${d("te")}న ${doctor} రాసిన కన్సల్టేషన్ నోట్. సందర్శనకు కారణం: ${complaint}.${p ? ` డాక్టర్ సూచనలు (రాసినట్లుగా): ${p}.` : ""}${followUp ? ` మళ్ళీ కలవాల్సింది: ${followUp}.` : ""} ఏదైనా అర్థం కాకపోతే మీ డాక్టర్‌ను అడగండి.`,
  };
}

export function prescriptionExplain(doctor: string, date: Date, meds: Med[]): Record<Lang, string> {
  const n = meds.length;
  return {
    en: `This prescription lists ${n} medicine${n > 1 ? "s" : ""} written by ${doctor} on ${formatDate(date, "en")}. Take them exactly as written. Do not start, stop or change any medicine without talking to your doctor or pharmacist.`,
    hi: `इस पर्चे में ${formatDate(date, "hi")} को ${doctor} द्वारा लिखी गई ${n} दवाइयाँ हैं। इन्हें ठीक वैसे ही लें जैसा लिखा है। डॉक्टर या फ़ार्मासिस्ट से बात किए बिना कोई दवा शुरू, बंद या बदलें नहीं।`,
    te: `ఈ ప్రిస్క్రిప్షన్‌లో ${formatDate(date, "te")}న ${doctor} రాసిన ${n} మందులు ఉన్నాయి. వాటిని రాసినట్లే వాడండి. డాక్టర్ లేదా ఫార్మసిస్ట్‌తో మాట్లాడకుండా ఏ మందునూ మొదలుపెట్టవద్దు, ఆపవద్దు, మార్చవద్దు.`,
  };
}

export function homeVisitExplain(asha: string, date: Date, v: { bp?: string; weight?: string; sugar?: string }): Record<Lang, string> {
  const parts = (l: Lang) => {
    const L = {
      en: { bp: "blood pressure", w: "weight", s: "blood sugar" },
      hi: { bp: "ब्लड प्रेशर", w: "वज़न", s: "ब्लड शुगर" },
      te: { bp: "బీపీ", w: "బరువు", s: "షుగర్" },
    }[l];
    return [v.bp && `${L.bp} ${v.bp}`, v.weight && `${L.w} ${v.weight}`, v.sugar && `${L.s} ${v.sugar}`].filter(Boolean).join(", ");
  };
  return {
    en: `This is a home visit note recorded by ASHA worker ${asha} on ${formatDate(date, "en")}.${parts("en") ? ` Readings: ${parts("en")}.` : ""} These are home readings, not a diagnosis. Share them with your doctor.`,
    hi: `यह ${formatDate(date, "hi")} को आशा कार्यकर्ता ${asha} द्वारा दर्ज घर की मुलाक़ात का नोट है।${parts("hi") ? ` रीडिंग: ${parts("hi")}।` : ""} ये घर पर ली गई रीडिंग हैं, निदान नहीं। इन्हें अपने डॉक्टर को दिखाएँ।`,
    te: `ఇది ${formatDate(date, "te")}న ఆశా కార్యకర్త ${asha} నమోదు చేసిన ఇంటి సందర్శన నోట్.${parts("te") ? ` రీడింగ్‌లు: ${parts("te")}.` : ""} ఇవి ఇంట్లో తీసిన రీడింగ్‌లు, రోగనిర్ధారణ కాదు. వీటిని మీ డాక్టర్‌కు చూపించండి.`,
  };
}
