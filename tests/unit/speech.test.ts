import { describe, expect, it, vi } from "vitest";
import { WebSpeechRecognizer, WebSpeechSynth, mapRecognitionError, SPEECH_ERROR_TEXT } from "@/lib/voice/speech";

class FakeRecognition {
  static last: FakeRecognition;
  lang = ""; continuous = true; interimResults = false; maxAlternatives = 0;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;
  constructor() { FakeRecognition.last = this; }
  start() { this.onstart?.(); }
  stop() { this.onend?.(); }
  abort() { this.onend?.(); }
}

describe("speech recognition adapter", () => {
  it("reports unsupported browsers without faking input", () => {
    const r = new WebSpeechRecognizer({});
    expect(r.isSupported()).toBe(false);
    const onError = vi.fn(), onFinal = vi.fn();
    r.start("te", { onFinal, onError });
    expect(onError).toHaveBeenCalledWith("unsupported");
    expect(onFinal).not.toHaveBeenCalled();
  });
  it("uses the right BCP-47 code per language and delivers final text", () => {
    const r = new WebSpeechRecognizer({ webkitSpeechRecognition: FakeRecognition });
    const onFinal = vi.fn(), onInterim = vi.fn();
    r.start("te", { onFinal, onInterim });
    const rec = FakeRecognition.last;
    expect(rec.lang).toBe("te-IN");
    expect(rec.continuous).toBe(false);
    expect(rec.interimResults).toBe(true);
    const mkRes = (t: string, isFinal: boolean) => Object.assign([{ transcript: t, confidence: 0.9 }], { isFinal });
    rec.onresult!({ resultIndex: 0, results: [mkRes("నా హెల్త్", false)] });
    expect(onInterim).toHaveBeenCalledWith("నా హెల్త్");
    rec.onresult!({ resultIndex: 0, results: [mkRes("నా హెల్త్ రికార్డ్స్ చూపించు ", true)] });
    expect(onFinal).toHaveBeenCalledWith("నా హెల్త్ రికార్డ్స్ చూపించు", 0.9);
    r.start("hi", { onFinal });
    expect(FakeRecognition.last.lang).toBe("hi-IN");
  });
  it("maps recognition errors", () => {
    const r = new WebSpeechRecognizer({ SpeechRecognition: FakeRecognition });
    const onError = vi.fn();
    r.start("en", { onFinal: vi.fn(), onError });
    FakeRecognition.last.onerror!({ error: "not-allowed" });
    expect(onError).toHaveBeenCalledWith("not-allowed");
    expect(mapRecognitionError("service-not-allowed")).toBe("not-allowed");
    expect(mapRecognitionError("language-not-supported")).toBe("language-not-supported");
    expect(mapRecognitionError("weird")).toBe("unknown");
    for (const code of Object.keys(SPEECH_ERROR_TEXT)) {
      const t = SPEECH_ERROR_TEXT[code as keyof typeof SPEECH_ERROR_TEXT];
      expect(t.en && t.hi && t.te).toBeTruthy();
    }
  });
});

describe("speech synthesis adapter", () => {
  it("detects missing voices (e.g. no Telugu voice installed)", () => {
    const synth = { getVoices: () => [{ lang: "en-IN" }, { lang: "hi-IN" }], cancel: vi.fn(), speak: vi.fn() };
    const s = new WebSpeechSynth({ speechSynthesis: synth, SpeechSynthesisUtterance: function () {} });
    expect(s.isSupported()).toBe(true);
    expect(s.hasVoiceFor("en")).toBe(true);
    expect(s.hasVoiceFor("hi")).toBe(true);
    expect(s.hasVoiceFor("te")).toBe(false);
  });
  it("is a safe no-op when unsupported", async () => {
    const s = new WebSpeechSynth({});
    expect(s.isSupported()).toBe(false);
    await expect(s.speak("hello", "en")).resolves.toBeUndefined();
  });
});

describe("female voice preference", () => {
  it("picks a female device voice over a male one for the same language", async () => {
    const spoken: { voice?: { name: string } }[] = [];
    const synth = {
      getVoices: () => [{ lang: "en-IN", name: "Microsoft Ravi - English (India)" }, { lang: "en-IN", name: "Microsoft Heera - English (India)" }, { lang: "hi-IN", name: "Microsoft Hemant" }, { lang: "hi-IN", name: "Microsoft Kalpana" }],
      cancel: vi.fn(),
      speak: (u: { voice?: { name: string }; onend?: () => void }) => { spoken.push(u); u.onend?.(); },
    };
    function U(this: Record<string, unknown>, text: string) { this.text = text; }
    const s = new WebSpeechSynth({ speechSynthesis: synth, SpeechSynthesisUtterance: U });
    await s.speak("hello", "en");
    await s.speak("नमस्ते", "hi");
    expect(spoken[0].voice?.name).toContain("Heera");
    expect(spoken[1].voice?.name).toContain("Kalpana");
  });
});
