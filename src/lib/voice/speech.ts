// Speech adapters. The app talks to these interfaces only, so the browser Web Speech
// implementation can be swapped for BHASHINI, Pipecat or another STT/TTS provider.
import { LANG_META, type Lang } from "../domain";

export type SpeechErrorCode =
  | "unsupported"
  | "not-allowed"
  | "no-speech"
  | "audio-capture"
  | "network"
  | "language-not-supported"
  | "aborted"
  | "unknown";

export interface RecognizerCallbacks {
  onInterim?: (text: string) => void;
  onFinal: (text: string, confidence: number | null) => void;
  onError?: (code: SpeechErrorCode) => void;
  onEnd?: () => void;
  onStart?: () => void;
}

export interface SpeechRecognizerAdapter {
  readonly id: string;
  isSupported(): boolean;
  start(lang: Lang, cb: RecognizerCallbacks): void;
  stop(): void;
  abort(): void;
}

export interface SpeechSynthAdapter {
  readonly id: string;
  isSupported(): boolean;
  /** Whether an installed voice can speak this language (Telugu voices are often missing). */
  hasVoiceFor(lang: Lang): boolean;
  speak(text: string, lang: Lang): Promise<void>;
  cancel(): void;
}

export function mapRecognitionError(error: string | undefined): SpeechErrorCode {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "not-allowed";
    case "no-speech":
      return "no-speech";
    case "audio-capture":
      return "audio-capture";
    case "network":
      return "network";
    case "language-not-supported":
      return "language-not-supported";
    case "aborted":
      return "aborted";
    default:
      return "unknown";
  }
}

export const SPEECH_ERROR_TEXT: Record<SpeechErrorCode, Record<Lang, string>> = {
  unsupported: {
    en: "Voice input isn't supported in this browser. Please use Chrome or Edge, or type your command below.",
    hi: "इस ब्राउज़र में आवाज़ इनपुट समर्थित नहीं है। कृपया Chrome या Edge इस्तेमाल करें, या नीचे टाइप करें।",
    te: "ఈ బ్రౌజర్‌లో వాయిస్ ఇన్‌పుట్‌కు సపోర్ట్ లేదు. దయచేసి Chrome లేదా Edge వాడండి, లేదా కింద టైప్ చేయండి.",
  },
  "not-allowed": {
    en: "Microphone permission was denied. Allow the microphone in your browser's address bar, or type below.",
    hi: "माइक्रोफ़ोन की अनुमति नहीं मिली। ब्राउज़र के एड्रेस बार में माइक्रोफ़ोन की अनुमति दें, या नीचे टाइप करें।",
    te: "మైక్రోఫోన్ అనుమతి నిరాకరించబడింది. బ్రౌజర్ అడ్రస్ బార్‌లో మైక్రోఫోన్‌కు అనుమతి ఇవ్వండి, లేదా కింద టైప్ చేయండి.",
  },
  "no-speech": {
    en: "I didn't hear anything. Tap the microphone and try again.",
    hi: "मुझे कुछ सुनाई नहीं दिया। माइक्रोफ़ोन दबाकर फिर कोशिश करें।",
    te: "నాకు ఏమీ వినిపించలేదు. మైక్రోఫోన్ నొక్కి మళ్ళీ ప్రయత్నించండి.",
  },
  "audio-capture": {
    en: "No microphone was found. Please connect one, or type below.",
    hi: "कोई माइक्रोफ़ोन नहीं मिला। कृपया माइक्रोफ़ोन लगाएँ, या नीचे टाइप करें।",
    te: "మైక్రోఫోన్ కనిపించలేదు. దయచేసి ఒకటి కనెక్ట్ చేయండి, లేదా కింద టైప్ చేయండి.",
  },
  network: {
    en: "The browser's speech service couldn't be reached (it needs internet). You can type instead.",
    hi: "ब्राउज़र की स्पीच सेवा से संपर्क नहीं हो सका (इंटरनेट चाहिए)। आप टाइप कर सकते हैं।",
    te: "బ్రౌజర్ స్పీచ్ సేవ అందుబాటులో లేదు (ఇంటర్నెట్ అవసరం). మీరు టైప్ చేయవచ్చు.",
  },
  "language-not-supported": {
    en: "This browser can't recognise speech in the selected language. Try Chrome, switch language, or type below.",
    hi: "यह ब्राउज़र चुनी गई भाषा में आवाज़ नहीं पहचान सकता। Chrome आज़माएँ, भाषा बदलें, या नीचे टाइप करें।",
    te: "ఈ బ్రౌజర్ ఎంచుకున్న భాషలో మాటను గుర్తించలేదు. Chrome ప్రయత్నించండి, భాష మార్చండి, లేదా కింద టైప్ చేయండి.",
  },
  aborted: { en: "Listening stopped.", hi: "सुनना बंद किया।", te: "వినడం ఆపాను." },
  unknown: {
    en: "Something went wrong with voice input. Please try again or type below.",
    hi: "आवाज़ इनपुट में कुछ गड़बड़ हुई। फिर कोशिश करें या नीचे टाइप करें।",
    te: "వాయిస్ ఇన్‌పుట్‌లో ఏదో తప్పు జరిగింది. మళ్ళీ ప్రయత్నించండి లేదా కింద టైప్ చేయండి.",
  },
};

// ---------------------------------------------------------------------------
// Web Speech API implementations
// ---------------------------------------------------------------------------
type AnyRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

function getRecognitionCtor(w: unknown = typeof window !== "undefined" ? window : undefined): (new () => AnyRecognition) | null {
  if (!w) return null;
  const win = w as { SpeechRecognition?: new () => AnyRecognition; webkitSpeechRecognition?: new () => AnyRecognition };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

export class WebSpeechRecognizer implements SpeechRecognizerAdapter {
  readonly id = "web-speech";
  private rec: AnyRecognition | null = null;
  constructor(private readonly win: unknown = typeof window !== "undefined" ? window : undefined) {}

  isSupported() {
    return getRecognitionCtor(this.win) !== null;
  }

  start(lang: Lang, cb: RecognizerCallbacks) {
    const Ctor = getRecognitionCtor(this.win);
    if (!Ctor) {
      cb.onError?.("unsupported");
      cb.onEnd?.();
      return;
    }
    this.abort();
    const rec = new Ctor();
    rec.lang = LANG_META[lang].bcp47;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let finalSent = false;
    rec.onstart = () => cb.onStart?.();
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const alt = res[0];
        if (res.isFinal && !finalSent) {
          finalSent = true;
          cb.onFinal(alt.transcript.trim(), Number.isFinite(alt.confidence) ? alt.confidence : null);
        } else interim += alt.transcript;
      }
      if (interim) cb.onInterim?.(interim);
    };
    rec.onerror = (e) => cb.onError?.(mapRecognitionError(e.error));
    rec.onend = () => {
      this.rec = null;
      cb.onEnd?.();
    };
    this.rec = rec;
    try {
      rec.start();
    } catch {
      cb.onError?.("unknown");
      cb.onEnd?.();
    }
  }

  stop() {
    this.rec?.stop();
  }
  abort() {
    this.rec?.abort();
    this.rec = null;
  }
}

const FEMALE_VOICE = /female|woman|heera|kalpana|swara|neerja|shruti|veena|lekha|aditi|raveena|priya|kajal|google/i;
const MALE_VOICE = /\bmale\b|ravi|hemant|madhur|prabhat|mohan|rishi|aarav/i;

export class WebSpeechSynth implements SpeechSynthAdapter {
  readonly id = "web-speech-synthesis";
  constructor(private readonly win: unknown = typeof window !== "undefined" ? window : undefined) {}

  private get synth(): SpeechSynthesis | null {
    const w = this.win as { speechSynthesis?: SpeechSynthesis } | undefined;
    return w?.speechSynthesis ?? null;
  }
  isSupported() {
    return this.synth !== null && typeof (this.win as { SpeechSynthesisUtterance?: unknown })?.SpeechSynthesisUtterance === "function";
  }
  private voiceFor(lang: Lang): SpeechSynthesisVoice | undefined {
    const voices = this.synth?.getVoices() ?? [];
    const bcp = LANG_META[lang].bcp47.toLowerCase();
    const base = bcp.split("-")[0];
    const exact = voices.filter((v) => v.lang.toLowerCase().replace("_", "-") === bcp);
    const pool = exact.length ? exact : voices.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(base));
    // Prefer a female voice (the assistant's persona), e.g. Microsoft Heera/Kalpana/Swara, Google हिन्दी.
    return pool.find((v) => FEMALE_VOICE.test(v.name) && !MALE_VOICE.test(v.name)) ?? pool.find((v) => !MALE_VOICE.test(v.name)) ?? pool[0];
  }
  hasVoiceFor(lang: Lang) {
    return Boolean(this.voiceFor(lang));
  }
  speak(text: string, lang: Lang): Promise<void> {
    return new Promise((resolve) => {
      const synth = this.synth;
      if (!synth || !this.isSupported()) return resolve();
      synth.cancel();
      const U = (this.win as { SpeechSynthesisUtterance: typeof SpeechSynthesisUtterance }).SpeechSynthesisUtterance;
      const u = new U(text);
      u.lang = LANG_META[lang].bcp47;
      const v = this.voiceFor(lang);
      if (v) u.voice = v;
      u.rate = 0.95; // slightly slower for elderly listeners
      u.onend = () => resolve();
      u.onerror = () => resolve();
      synth.speak(u);
    });
  }
  cancel() {
    this.synth?.cancel();
  }
}
