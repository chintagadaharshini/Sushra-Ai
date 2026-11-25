import { Globe, Keyboard, Mic, MonitorSmartphone, Volume2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TryCommand } from "@/components/app/try-command";

export const metadata = { title: "Help & voice guide" };

const GROUPS: { title: string; rows: { en: string; hi: string; te: string }[] }[] = [
  { title: "Health records", rows: [
    { en: "Show my health records", hi: "मेरी मेडिकल रिपोर्ट दिखाओ", te: "నా హెల్త్ రికార్డ్స్ చూపించు" },
    { en: "Open my latest blood test report", hi: "मेरी ताज़ा ब्लड टेस्ट रिपोर्ट खोलो", te: "నా తాజా బ్లడ్ టెస్ట్ రిపోర్ట్ తెరువు" },
    { en: "Open the second one", hi: "दूसरा वाला खोलो", te: "రెండవది తెరువు" },
  ] },
  { title: "Explain a report", rows: [
    { en: "Explain it in Telugu", hi: "मेरी मेडिकल रिपोर्ट समझाओ", te: "దీన్ని తెలుగులో వివరించు" },
    { en: "Explain my cholesterol report", hi: "मेरी कोलेस्ट्रॉल रिपोर्ट समझाओ", te: "నా కొలెస్ట్రాల్ రిపోర్ట్ వివరించు" },
  ] },
  { title: "Facilities & appointments", rows: [
    { en: "Find hospitals near Visakhapatnam", hi: "हैदराबाद में अस्पताल खोजो", te: "విశాఖపట్నంలో ఆసుపత్రులు వెతుకు" },
    { en: "Show my appointments", hi: "मेरे अपॉइंटमेंट दिखाओ", te: "నా అపాయింట్‌మెంట్స్ చూపించు" },
    { en: "Open appointment booking", hi: "अपॉइंटमेंट बुकिंग खोलो", te: "అపాయింట్‌మెంట్ బుకింగ్ తెరువు" },
  ] },
  { title: "Forms & preferences (asks before saving)", rows: [
    { en: "Change my preferred city to Hyderabad", hi: "मेरा शहर हैदराबाद कर दो", te: "నా నగరం విశాఖపట్నం కి మార్చు" },
    { en: "Set my preferred language to Telugu", hi: "मेरी पसंदीदा भाषा हिंदी करो", te: "నా ఇష్టమైన భాష తెలుగు కి మార్చు" },
    { en: "Make the text large", hi: "अक्षर बड़े करो", te: "అక్షరాలు పెద్దవి చేయి" },
  ] },
  { title: "For doctors & ASHA workers", rows: [
    { en: "Open my patients", hi: "मेरे मरीज़ दिखाओ", te: "నా రోగులను చూపించు" },
    { en: "Register a new patient", hi: "नया मरीज़ रजिस्टर करो", te: "కొత్త రోగిని నమోదు చేయి" },
    { en: "Explain it in Telugu", hi: "इसे हिंदी में समझाओ", te: "దీన్ని తెలుగులో వివరించు" },
  ] },
  { title: "Navigation & control", rows: [
    { en: "What can I do on this page?", hi: "मदद", te: "సహాయం" },
    { en: "Go to dashboard", hi: "डैशबोर्ड खोलो", te: "డాష్‌బోర్డ్ తెరువు" },
    { en: "Scroll down / Go back", hi: "नीचे स्क्रॉल करो / पीछे जाओ", te: "కిందకి స్క్రోల్ చేయి / వెనక్కి వెళ్ళు" },
    { en: "Switch to Hindi", hi: "तेलुगु में बात करो", te: "ఇంగ్లీష్ లో మాట్లాడు" },
    { en: "Cancel", hi: "रहने दो", te: "వద్దు" },
  ] },
];

export default function HelpPage() {
  return (
    <div>
      <PageHeader title="Help & voice command guide" subtitle="Tap any command to run it through the assistant, exactly as if you had spoken it." />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {[
          { icon: Mic, t: "1. Tap the mic", d: "Press the round button at the bottom right (or Alt+V). Allow microphone access the first time." },
          { icon: Volume2, t: "2. Speak naturally", d: "Choose EN / हिं / తె first. Speak a full sentence. Your words appear live on screen." },
          { icon: Keyboard, t: "3. Or type", d: "Every command also works by typing — useful in noisy places or unsupported browsers." },
        ].map(({ icon: I, t, d }) => (
          <Card key={t}><CardContent className="pt-5"><I className="size-7 text-brand-600" aria-hidden /><p className="mt-2 font-bold">{t}</p><p className="text-sm text-muted">{d}</p></CardContent></Card>
        ))}
      </div>
      <div className="space-y-5">
        {GROUPS.map((g) => (
          <Card key={g.title}>
            <CardHeader><CardTitle>{g.title}</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {(["en", "hi", "te"] as const).map((l) => (
                <div key={l}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{l === "en" ? "English" : l === "hi" ? "हिन्दी" : "తెలుగు"}</p>
                  <div className="flex flex-col items-start gap-2">{g.rows.map((r) => <TryCommand key={r[l]} cmd={r[l].split(" / ")[0]} label={r[l]} />)}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><MonitorSmartphone className="size-5" aria-hidden />Browser & microphone compatibility</CardTitle></CardHeader>
          <CardContent className="text-[0.95rem]">
            <ul className="space-y-1.5">
              <li className="flex gap-2"><Globe className="mt-0.5 size-4.5 shrink-0" aria-hidden /><span><b>Chrome / Edge (desktop & Android):</b> voice input in English, Hindi and Telugu (needs internet; uses the browser&apos;s speech service).</span></li>
              <li><b>Safari (macOS / iOS):</b> voice input support varies by version; Telugu may be unavailable. Typing always works.</li>
              <li><b>Firefox:</b> no built-in speech recognition — use typing.</li>
              <li><b>Spoken replies:</b> when the voice service is running, replies use Sarvam AI voices in Telugu, Hindi and English on every device. Otherwise the device&apos;s own voices are used (Telugu is often missing on Windows); the text is always shown.</li>
              <li><b>Studio voice:</b> a live, hands-free conversation using Sarvam AI speech models. Use headphones for the best results; on speakers the microphone pauses while the assistant talks.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
