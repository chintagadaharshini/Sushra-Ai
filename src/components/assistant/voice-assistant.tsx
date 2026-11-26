"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, AudioLines, Check, PhoneOff, ChevronDown, Keyboard, Mic, MicOff, Send, Square, Volume2, VolumeX, X, FileText, Hospital, CalendarDays, Sparkles, Loader2 } from "lucide-react";
import { useAssistant, type ChatMessage } from "@/lib/voice/store";
import { useAssistantEngine } from "./use-assistant-engine";
import { useMicLevel } from "./use-mic-level";
import { useStudioVoice } from "./use-studio-voice";
import { LANGS, LANG_META, type Lang } from "@/lib/domain";
import { R } from "@/lib/voice/responses";
import { cn } from "@/lib/utils";

const QUICK: Record<Lang, { icon: typeof FileText; title: string; cmd: string }[]> = {
  en: [
    { icon: FileText, title: "Show my health records", cmd: "Show my health records" },
    { icon: Sparkles, title: "Explain my latest report", cmd: "Explain my latest report" },
    { icon: Hospital, title: "Find hospitals in Hyderabad", cmd: "Find hospitals in Hyderabad" },
    { icon: CalendarDays, title: "Show my appointments", cmd: "Show my appointments" },
  ],
  hi: [
    { icon: FileText, title: "मेरी मेडिकल रिपोर्ट दिखाओ", cmd: "मेरी मेडिकल रिपोर्ट दिखाओ" },
    { icon: Sparkles, title: "मेरी ताज़ा रिपोर्ट समझाओ", cmd: "मेरी ताज़ा रिपोर्ट समझाओ" },
    { icon: Hospital, title: "हैदराबाद में अस्पताल खोजो", cmd: "हैदराबाद में अस्पताल खोजो" },
    { icon: CalendarDays, title: "मेरे अपॉइंटमेंट दिखाओ", cmd: "मेरे अपॉइंटमेंट दिखाओ" },
  ],
  te: [
    { icon: FileText, title: "నా హెల్త్ రికార్డ్స్ చూపించు", cmd: "నా హెల్త్ రికార్డ్స్ చూపించు" },
    { icon: Sparkles, title: "నా తాజా రిపోర్ట్ వివరించు", cmd: "నా తాజా రిపోర్ట్ వివరించు" },
    { icon: Hospital, title: "విశాఖపట్నంలో ఆసుపత్రులు వెతుకు", cmd: "విశాఖపట్నంలో ఆసుపత్రులు వెతుకు" },
    { icon: CalendarDays, title: "నా అపాయింట్‌మెంట్స్ చూపించు", cmd: "నా అపాయింట్‌మెంట్స్ చూపించు" },
  ],
};

const UI: Record<string, Record<Lang, string>> = {
  hey: { en: "Namaste", hi: "नमस्ते", te: "నమస్తే" },
  quick: { en: "Try saying", hi: "ऐसे बोलकर देखें", te: "ఇలా చెప్పి చూడండి" },
  placeholder: { en: "Type a command…", hi: "कमांड टाइप करें…", te: "కమాండ్ టైప్ చేయండి…" },
  idle: { en: "Microphone off — tap to speak", hi: "माइक बंद — बोलने के लिए दबाएँ", te: "మైక్ ఆఫ్ — మాట్లాడటానికి నొక్కండి" },
  listening: { en: "Listening… tap to stop", hi: "सुन रही हूँ… रोकने के लिए दबाएँ", te: "వింటున్నాను… ఆపడానికి నొక్కండి" },
  processing: { en: "Working on it…", hi: "काम कर रही हूँ…", te: "చేస్తున్నాను…" },
  speaking: { en: "Speaking…", hi: "बोल रही हूँ…", te: "మాట్లాడుతున్నాను…" },
  "awaiting-confirmation": { en: "Waiting for your yes or no", hi: "आपके हाँ या नहीं का इंतज़ार", te: "మీ అవును/వద్దు కోసం ఎదురుచూస్తున్నాను" },
  "awaiting-choice": { en: "Waiting for your choice", hi: "आपके चुनाव का इंतज़ार", te: "మీ ఎంపిక కోసం ఎదురుచూస్తున్నాను" },
  yes: { en: "Yes, change it", hi: "हाँ, बदलें", te: "అవును, మార్చండి" },
  no: { en: "No, cancel", hi: "नहीं, रद्द करें", te: "వద్దు, రద్దు" },
  proposed: { en: "Proposed change", hi: "प्रस्तावित बदलाव", te: "ప్రతిపాదిత మార్పు" },
  unsupported: {
    en: "Voice input isn't available in this browser. Typing works everywhere — or use Chrome / Edge for voice.",
    hi: "इस ब्राउज़र में आवाज़ इनपुट उपलब्ध नहीं है। टाइप करें, या आवाज़ के लिए Chrome / Edge इस्तेमाल करें।",
    te: "ఈ బ్రౌజర్‌లో వాయిస్ ఇన్‌పుట్ లేదు. టైప్ చేయండి, లేదా వాయిస్ కోసం Chrome / Edge వాడండి.",
  },
  browserMode: { en: "Browser voice", hi: "ब्राउज़र आवाज़", te: "బ్రౌజర్ వాయిస్" },
  studioMode: { en: "Studio voice · Sarvam", hi: "स्टूडियो आवाज़ · Sarvam", te: "స్టూడియో వాయిస్ · Sarvam" },
  studioIdle: { en: "Tap to start a live conversation", hi: "लाइव बातचीत शुरू करने के लिए दबाएँ", te: "లైవ్ సంభాషణ ప్రారంభించడానికి నొక్కండి" },
  enableSound: { en: "Tap to hear the assistant", hi: "सहायक को सुनने के लिए टैप करें", te: "సహాయకురాలిని వినడానికి నొక్కండి" },
  studioConnecting: { en: "Connecting…", hi: "जुड़ रहा है…", te: "కనెక్ట్ అవుతోంది…" },
  studioLive: { en: "Live — just talk. Tap to end.", hi: "लाइव — बस बोलिए। ख़त्म करने के लिए दबाएँ।", te: "లైవ్ — మాట్లాడండి. ముగించడానికి నొక్కండి." },
  studioUnavailable: {
    en: "Studio voice isn't running. Start the voice-agent service with Sarvam and Groq keys (see README). Browser voice still works.",
    hi: "स्टूडियो आवाज़ चालू नहीं है। Sarvam और Groq कुंजियों के साथ voice-agent सेवा शुरू करें (README देखें)। ब्राउज़र आवाज़ काम करती है।",
    te: "స్టూడియో వాయిస్ నడవడం లేదు. Sarvam, Groq కీలతో voice-agent సేవను ప్రారంభించండి (README చూడండి). బ్రౌజర్ వాయిస్ పనిచేస్తుంది.",
  },
  studioWaking: {
    en: "Waking the Sarvam voice service (up to a minute after it has been idle)…",
    hi: "Sarvam आवाज़ सेवा चालू हो रही है (कुछ देर निष्क्रिय रहने पर एक मिनट तक)…",
    te: "Sarvam వాయిస్ సేవ ప్రారంభమవుతోంది (కొంతసేపు ఖాళీగా ఉంటే ఒక నిమిషం వరకు)…",
  },
  privacy: { en: "Mic is only on while the green indicator shows. Audio is not recorded or stored.", hi: "हरा संकेत दिखने पर ही माइक चालू है। आवाज़ रिकॉर्ड या सेव नहीं होती।", te: "ఆకుపచ్చ సూచిక కనిపించినప్పుడే మైక్ ఆన్. ఆడియో రికార్డ్ లేదా సేవ్ కాదు." },
};

/** Plain-language explanation of a Studio connection failure (the raw reason is shown beside it). */
function studioErrorText(reason: string | null) {
  if (!reason) return "Studio voice could not connect.";
  if (/permission|NotAllowed|denied/i.test(reason)) return "Microphone permission was blocked. Allow the mic for this site and try again.";
  if (reason === "waking") return "The voice service is still starting. Wait a moment and try again.";
  if (reason === "not-configured") return "The voice service is not configured on the server (VOICE_AGENT_SHARED_SECRET / VOICE_AGENT_URL).";
  return "Studio voice could not connect.";
}

function Orb({ size = 44, active = false }: { size?: number; active?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn("relative inline-block shrink-0 rounded-full", active && "animate-pulse")}
      style={{
        width: size,
        height: size,
        background: "radial-gradient(circle at 32% 28%, #ecfdf7 0%, #6ee5bd 38%, #12b386 70%, #0a755b 100%)",
        boxShadow: "0 8px 22px -6px rgb(18 179 134 / .55), inset 0 -4px 10px rgb(10 76 62 / .35)",
      }}
    />
  );
}

/** Three glowing pills that react to the real microphone level. */
function VoicePills({ level, active }: { level: number; active: boolean }) {
  const base = active ? 0.35 + level * 0.9 : 0.3;
  const heights = [base * 0.7, base, base * 0.7];
  return (
    <div className="relative flex h-40 items-center justify-center gap-3" aria-hidden>
      <div className="absolute inset-0 m-auto size-40 rounded-full bg-brand-300/40 blur-3xl" />
      {heights.map((h, i) => (
        <motion.span
          key={i}
          className="relative w-12 rounded-full bg-gradient-to-b from-brand-300 via-brand-400 to-brand-500 shadow-[0_0_30px_rgb(52_209_160/.55)]"
          animate={{ height: `${Math.max(28, Math.min(150, h * 150))}px` }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
        />
      ))}
    </div>
  );
}

function Waveform({ level, active }: { level: number; active: boolean }) {
  const bars = 28;
  return (
    <div className="flex h-8 items-center justify-center gap-[3px]" aria-hidden>
      {Array.from({ length: bars }).map((_, i) => {
        const phase = Math.sin((i / bars) * Math.PI);
        const h = active ? 6 + phase * level * 26 + ((i * 7) % 5) * level * 2 : 4;
        return <span key={i} className="w-[3px] rounded-full bg-ink/70 transition-[height] duration-100" style={{ height: `${h}px` }} />;
      })}
    </div>
  );
}

function MessageBubble({ m, onChoose, onConfirm, lang }: { m: ChatMessage; onChoose: (i: number, label: string) => void; onConfirm: (yes: boolean) => void; lang: Lang }) {
  const isUser = m.role === "user";
  const p = m.pending;
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[0.93rem] leading-relaxed",
          isUser ? "rounded-br-md bg-ink text-white" : "rounded-bl-md border border-line bg-white text-ink",
          m.tone === "error" && "border-red-200 bg-red-50",
          m.tone === "warning" && "border-amber-200 bg-amber-50",
        )}
        lang={LANG_META[m.lang].bcp47}
      >
        {m.tone === "error" && <AlertTriangle className="mb-1 inline size-4 text-bad" aria-label="Error" />} {m.text}
        {m.explanation && m.explanation.items.length > 0 && (
          <ul className="mt-2 space-y-1.5 border-t border-line pt-2 text-[0.85rem]">
            {m.explanation.items.map((it) => (
              <li key={it.testCode} className="flex items-start gap-2">
                <span className={cn("mt-0.5 rounded-md px-1.5 text-[0.7rem] font-bold", it.status === "normal" ? "bg-brand-50 text-brand-800" : it.status === "unknown" ? "bg-cream text-ink-soft" : "bg-amber-100 text-warn")}>
                  {it.status === "low" ? "↓" : it.status === "high" ? "↑" : it.status === "normal" ? "✓" : "?"}
                </span>
                <span>
                  <b>{it.name}</b> {it.valueDisplay} <span className="text-muted">({it.rangeDisplay})</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {p?.kind === "choose" && !m.resolved && (
          <div className="mt-2.5 space-y-1.5">
            {p.options.map((o, i) => (
              <button key={o.id} onClick={() => onChoose(i, o.label)} className="flex w-full items-center gap-3 rounded-xl border border-line bg-canvas px-3 py-2 text-left hover:border-brand-400 hover:bg-brand-50 cursor-pointer">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-ink text-xs font-bold text-white">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{o.label}</span>
                  {o.sublabel && <span className="block truncate text-xs text-muted">{o.sublabel}</span>}
                </span>
              </button>
            ))}
          </div>
        )}
        {p?.kind === "confirm" && !m.resolved && (
          <div className="mt-2.5 rounded-xl border border-brand-200 bg-brand-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-800">{UI.proposed[lang]}</p>
            <p className="mt-1 text-sm">
              <span className="font-semibold capitalize">{p.displayField}</span>:{" "}
              {p.previousDisplay && <><span className="text-muted line-through">{p.previousDisplay}</span> → </>}
              <span className="font-bold">{p.displayValue}</span>
            </p>
            <div className="mt-2.5 flex gap-2">
              <button onClick={() => onConfirm(true)} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 cursor-pointer"><Check className="size-4" />{UI.yes[lang]}</button>
              <button onClick={() => onConfirm(false)} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-sm font-semibold hover:bg-cream cursor-pointer"><X className="size-4" />{UI.no[lang]}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function VoiceAssistant({ userName }: { userName: string }) {
  const { open, setOpen, status, lang, setLang, voiceOn, setVoiceOn, interim, messages, ttsNotice, setTtsNotice, clearConversation, resolveMessage } = useAssistant();
  const engine = useAssistantEngine();
  const [text, setText] = useState("");
  const [supported, setSupported] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"browser" | "studio">("browser");
  const studio = useStudioVoice(engine.runAgentAction);
  const studioLive = studio.state === "connected";
  // Sarvam STT/TTS language is fixed per session: reconnect when the language changes.
  const prevLang = useRef(lang);
  const { connect: studioConnect, disconnect: studioDisconnect } = studio;
  useEffect(() => {
    if (prevLang.current !== lang && studioLive) void studioDisconnect().then(() => studioConnect());
    prevLang.current = lang;
  }, [lang, studioLive, studioConnect, studioDisconnect]);
  const listening = status === "listening";
  const level = useMicLevel(listening);
  const scrollRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setSupported(engine.isRecognitionSupported()), []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, interim]);

  // Typing into a form on the page minimises the panel so it never covers the form.
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el || !useAssistant.getState().open) return;
      if (!/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (el.closest('[aria-label="Voice assistant"]')) return;
      setOpen(false);
    };
    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, [setOpen]);

  // Keyboard: Alt+V toggles listening, Escape minimises
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        if (useAssistant.getState().status === "listening") engine.stopListening();
        else engine.startListening();
      }
      if (e.key === "Escape" && useAssistant.getState().open) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine, setOpen]);

  const toggleMic = () => (listening ? engine.stopListening() : engine.startListening());
  const send = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return;
    void engine.process(text);
    setText("");
  };
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <>
      {/* Screen-reader announcement of the latest reply */}
      <div ref={liveRef} aria-live="polite" className="sr-only">{lastAssistant?.text}</div>

      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            onClick={() => setOpen(true)}
            aria-label="Open voice assistant"
            className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-full bg-ink py-2 pl-2 pr-5 text-white shadow-glow hover:bg-ink-soft sm:bottom-7 sm:right-7 cursor-pointer"
          >
            <span className="grid size-14 place-items-center rounded-full bg-gradient-to-br from-brand-300 to-brand-600">
              <Mic className="size-7" aria-hidden />
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-bold">Ask Sushra AI</span>
              <span className="block text-xs text-brand-200">తెలుగు · हिन्दी · English</span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-label="Voice assistant"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed inset-x-2 bottom-2 z-50 flex max-h-[88dvh] flex-col overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-brand-50 via-white to-white shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[420px] sm:max-h-[min(760px,calc(100dvh-3rem))]"
          >
            {/* Header */}
            <div className="border-b border-line/70 px-4 pb-2.5 pt-3">
              <div className="flex items-center gap-2.5">
                <Orb size={34} active={status === "speaking"} />
                <p className="flex-1 text-[0.95rem] font-extrabold">Sushra AI</p>
                <button onClick={() => { setVoiceOn(!voiceOn); if (voiceOn) engine.stopAll(); }} aria-pressed={voiceOn} aria-label={voiceOn ? "Turn spoken replies off" : "Turn spoken replies on"}
                  className="grid size-9 place-items-center rounded-lg hover:bg-cream cursor-pointer" title="Voice replies">
                  {voiceOn ? <Volume2 className="size-4.5" /> : <VolumeX className="size-4.5" />}
                </button>
                <button onClick={() => setOpen(false)} aria-label="Minimise assistant" title="Minimise" className="grid size-9 place-items-center rounded-lg hover:bg-cream cursor-pointer">
                  <ChevronDown className="size-5" />
                </button>
                <button onClick={() => { engine.stopAll(); clearConversation(); setOpen(false); }} aria-label="Close assistant and end conversation" title="End conversation" className="grid size-9 place-items-center rounded-lg hover:bg-cream cursor-pointer">
                  <X className="size-5" />
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <p className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-xs font-medium text-muted" role="status">
                  <span className={cn("inline-block size-2 shrink-0 rounded-full", listening ? "bg-brand-500 animate-pulse" : status === "idle" ? "bg-slate-300" : "bg-amber-400")} aria-hidden />
                  <span className="truncate">{UI[status]?.[lang] ?? UI.idle[lang]}</span>
                </p>
                <div role="group" aria-label="Assistant language" className="flex shrink-0 rounded-lg border border-line bg-white p-0.5">
                  {LANGS.map((l) => (
                    <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} title={LANG_META[l].label}
                      className={cn("h-8 rounded-md px-2.5 text-xs font-bold cursor-pointer", lang === l ? "bg-ink text-white" : "text-ink-soft hover:bg-cream")}>
                      {LANG_META[l].native}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Body */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              <div role="tablist" aria-label="Voice engine" className="grid grid-cols-2 gap-1 rounded-xl bg-cream p-1 text-xs font-bold">
                {(["browser", "studio"] as const).map((m) => (
                  <button key={m} role="tab" aria-selected={mode === m} onClick={() => { if (m === "browser" && studioLive) void studio.disconnect(); setMode(m); }}
                    className={cn("h-8 rounded-lg cursor-pointer", mode === m ? "bg-white text-ink shadow-soft" : "text-muted hover:text-ink")}>
                    {m === "browser" ? UI.browserMode[lang] : UI.studioMode[lang]}
                  </button>
                ))}
              </div>
              {mode === "studio" && (studio.state === "waking" || studio.state === "checking") && (
                <p className="flex items-center gap-2 rounded-xl border border-line bg-cream p-3 text-sm text-ink-soft" role="status" data-testid="studio-waking">
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />{UI.studioWaking[lang]}
                </p>
              )}
              {mode === "studio" && (studio.state === "unavailable" || studio.state === "error") && (
                <p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-warn">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{studio.state === "error" ? studioErrorText(studio.reason) : UI.studioUnavailable[lang]} <span className="text-xs opacity-75" data-testid="studio-reason">({studio.reason})</span> <button onClick={() => void studio.recheck()} className="underline cursor-pointer">Retry</button></span>
                </p>
              )}
              {mode === "studio" && studioLive && studio.audioBlocked && (
                <button onClick={studio.enableSound} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 p-3 text-sm font-bold text-white hover:bg-brand-700 cursor-pointer">
                  <Volume2 className="size-4" aria-hidden />{UI.enableSound[lang]}
                </button>
              )}
              {mode === "studio" && studioLive && (
                <div className="rounded-2xl border border-brand-200 bg-brand-50 p-3">
                  <VoicePills level={studio.userSpeaking ? 0.8 : studio.botSpeaking ? 0.55 : 0.15} active />
                  <p className="text-center text-sm font-semibold text-brand-800" aria-live="polite">
                    {studio.userSpeaking ? "…" : studio.botSpeaking ? UI.speaking[lang] : UI.listening[lang].split("…")[0] + "…"}
                  </p>
                  {interim && <p className="mt-1 text-center text-lg font-semibold" lang={LANG_META[lang].bcp47}>{interim}</p>}
                </div>
              )}
              {supported === false && (
                <p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-warn"><MicOff className="mt-0.5 size-4 shrink-0" />{UI.unsupported[lang]}</p>
              )}
              {ttsNotice && (
                <p className="flex items-start gap-2 rounded-xl border border-line bg-cream p-2.5 text-xs text-ink-soft">
                  <VolumeX className="mt-0.5 size-3.5 shrink-0" />{ttsNotice}
                  <button onClick={() => setTtsNotice(undefined)} aria-label="Dismiss" className="ml-auto cursor-pointer"><X className="size-3.5" /></button>
                </p>
              )}

              {messages.length === 0 && !listening && (
                <div>
                  <Orb size={52} />
                  <p className="mt-3 text-2xl font-semibold text-ink">{UI.hey[lang]}, {userName}</p>
                  <p className="text-2xl font-extrabold text-ink">{R.greetingTitle[lang]}</p>
                  <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wider text-muted">[ {UI.quick[lang]} ]</p>
                  <div className="space-y-2">
                    {QUICK[lang].map(({ icon: Icon, title, cmd }) => (
                      <button key={cmd} onClick={() => engine.process(cmd)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-2.5 text-left shadow-soft hover:border-brand-300 cursor-pointer">
                        <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-5" /></span>
                        <span className="text-[0.93rem] font-semibold">“{title}”</span>
                      </button>
                    ))}
                  </div>
                  <Link href="/help" className="mt-3 inline-block text-sm font-semibold text-brand-700 underline-offset-4 hover:underline">All voice commands →</Link>
                </div>
              )}

              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  m={m}
                  lang={lang}
                  onChoose={(i, label) => { resolveMessage(m.id); void engine.process(String(i + 1), label); }}
                  onConfirm={(yes) => { resolveMessage(m.id); void engine.process(yes ? "yes" : "no", yes ? UI.yes[lang] : UI.no[lang]); }}
                />
              ))}

              {listening && (
                <div className="pt-2">
                  <VoicePills level={level} active />
                  <p className={cn("mt-3 min-h-[3rem] text-center text-xl font-semibold leading-snug", interim ? "text-ink" : "text-muted")} lang={LANG_META[lang].bcp47} aria-live="off">
                    {interim || `${LANG_META[lang].native}…`}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-line/70 bg-white px-3 pb-3 pt-2">
              {listening && <Waveform level={level} active />}
              <div className="flex items-center gap-2">
                <form onSubmit={send} className="relative flex-1">
                  <Keyboard className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={UI.placeholder[lang]}
                    aria-label="Type a command for the assistant"
                    lang={LANG_META[lang].bcp47}
                    className="h-12 w-full rounded-2xl border border-line bg-canvas pl-9 pr-11 text-[0.95rem] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
                  />
                  <button type="submit" aria-label="Send command" className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-xl text-ink hover:bg-cream cursor-pointer">
                    <Send className="size-4.5" />
                  </button>
                </form>
                {mode === "studio" ? (
                  <button
                    onClick={() => (studioLive ? void studio.disconnect() : void studio.connect())}
                    aria-label={studioLive ? "End live voice conversation" : "Start live voice conversation"}
                    aria-pressed={studioLive}
                    disabled={studio.state === "unavailable" || studio.state === "connecting" || studio.state === "checking" || studio.state === "waking"}
                    className={cn("grid size-14 shrink-0 place-items-center rounded-2xl text-white transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40", studioLive ? "bg-bad hover:bg-red-700" : "bg-brand-600 hover:bg-brand-700")}
                  >
                    {studioLive ? <PhoneOff className="size-6" /> : <AudioLines className="size-6" />}
                  </button>
                ) : (
                <button
                  onClick={toggleMic}
                  aria-label={listening ? "Stop listening" : "Start listening"}
                  aria-pressed={listening}
                  disabled={supported === false || status === "processing"}
                  className={cn(
                    "grid size-14 shrink-0 place-items-center rounded-2xl text-white transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40",
                    listening ? "bg-brand-600 animate-pulse-ring" : "bg-ink hover:bg-ink-soft",
                  )}
                >
                  {listening ? <Square className="size-5 fill-current" /> : <Mic className="size-6" />}
                </button>
                )}
              </div>
              <p className="mt-1.5 text-center text-[0.68rem] text-muted">
                {mode === "studio" ? (studio.state === "connecting" ? UI.studioConnecting[lang] : studioLive ? UI.studioLive[lang] : UI.studioIdle[lang]) + " · " : ""}
                {UI.privacy[lang]}{mode === "browser" ? " · Alt+V" : ""}
              </p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
