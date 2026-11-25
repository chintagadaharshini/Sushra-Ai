"use client";
// Hybrid speech output: Sarvam Bulbul (natural Telugu/Hindi/English, works on every device)
// when the voice service is running, otherwise the browser's own SpeechSynthesis.
import type { Lang } from "../domain";
import { WebSpeechSynth, type SpeechSynthAdapter } from "./speech";

let cloudAvailable: boolean | null = null;
let checking: Promise<boolean> | null = null;

export function checkCloudTts(): Promise<boolean> {
  if (cloudAvailable !== null) return Promise.resolve(cloudAvailable);
  checking ??= fetch("/api/voice-agent/status")
    .then((r) => (r.ok ? r.json() : { available: false }))
    .then((d: { available?: boolean }) => (cloudAvailable = Boolean(d.available)))
    .catch(() => (cloudAvailable = false))
    .finally(() => (checking = null));
  return checking;
}

export class HybridSpeechSynth implements SpeechSynthAdapter {
  readonly id = "hybrid-sarvam-web";
  private browser = new WebSpeechSynth();
  private audio: HTMLAudioElement | null = null;
  private generation = 0;

  isSupported() {
    return typeof window !== "undefined";
  }
  /** True if we can actually speak this language on this device. */
  hasVoiceFor(lang: Lang) {
    return cloudAvailable === true || this.browser.hasVoiceFor(lang);
  }
  async speak(text: string, lang: Lang): Promise<void> {
    this.cancel();
    const gen = ++this.generation;
    if (await checkCloudTts()) {
      try {
        const res = await fetch("/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: text.slice(0, 3000), lang }) });
        if (!res.ok) throw new Error(String(res.status));
        const { audios, mime } = (await res.json()) as { audios: string[]; mime: string };
        for (const b64 of audios) {
          if (gen !== this.generation) return; // cancelled / superseded
          await this.play(`data:${mime || "audio/wav"};base64,${b64}`);
        }
        return;
      } catch {
        /* fall through to the browser voice */
      }
    }
    if (gen === this.generation && this.browser.isSupported()) await this.browser.speak(text, lang);
  }
  private play(src: string) {
    return new Promise<void>((resolve) => {
      const a = new Audio(src);
      this.audio = a;
      a.onended = () => resolve();
      a.onerror = () => resolve();
      a.play().catch(() => resolve());
    });
  }
  cancel() {
    this.generation++;
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    this.browser.cancel();
  }
}

let shared: HybridSpeechSynth | null = null;
export function speaker() {
  shared ??= new HybridSpeechSynth();
  return shared;
}
