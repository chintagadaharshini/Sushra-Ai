"use client";
// Speech output for the browser-voice mode: Sarvam Bulbul (natural Telugu/Hindi/English, works on
// every device) through /api/tts. If Sarvam cannot be reached, the reply falls back to the
// browser's own voice AND the user is told so (never a silent swap).
import type { Lang } from "../domain";
import { useAssistant } from "./store";
import { WebSpeechSynth, type SpeechSynthAdapter } from "./speech";

type CloudState = { ok: boolean; reason: string | null; at: number };
let cloud: CloudState | null = null;
let checking: Promise<boolean> | null = null;
const RECHECK_MS = 30_000; // a failed check is retried, never cached for the whole session

/** Is Sarvam TTS usable? Only "not configured" style failures are remembered (briefly). */
export function checkCloudTts(): Promise<boolean> {
  if (cloud && (cloud.ok || Date.now() - cloud.at < RECHECK_MS)) return Promise.resolve(cloud.ok);
  checking ??= fetch("/api/voice-agent/status", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { available: false, reason: `app-${r.status}` }))
    .then((d: { available?: boolean; reason?: string | null }) => {
      // "waking" means Sarvam is fine but the agent is starting: still try /api/tts (it waits).
      const ok = Boolean(d.available) || d.reason === "waking";
      cloud = { ok, reason: d.reason ?? null, at: Date.now() };
      return ok;
    })
    .catch(() => {
      cloud = { ok: false, reason: "network", at: Date.now() };
      return false;
    })
    .finally(() => (checking = null));
  return checking;
}

const REASON_TEXT: Record<string, string> = {
  waking: "the voice service is still starting",
  "not-configured": "the voice service is not configured on the server",
  "missing-api-keys": "SARVAM_API_KEY / GROQ_API_KEY are not set on the voice agent",
  "secret-mismatch": "VOICE_AGENT_SHARED_SECRET differs between the web app and the voice agent",
  unreachable: "the voice service is unreachable",
  network: "the network request failed",
};

function notify(reason: string, usedDeviceVoice: boolean) {
  const why = REASON_TEXT[reason] ?? reason;
  useAssistant
    .getState()
    .setTtsNotice(`Sarvam voice unavailable (${why}). ${usedDeviceVoice ? "Using this device's voice for now." : "Replies are shown as text."} It will retry on the next reply.`);
}

export class HybridSpeechSynth implements SpeechSynthAdapter {
  readonly id = "hybrid-sarvam-web";
  private browser = new WebSpeechSynth();
  private audio: HTMLAudioElement | null = null;
  private generation = 0;
  /** Which engine produced the last reply (for UI/tests). */
  lastEngine: "sarvam" | "device" | "none" = "none";

  isSupported() {
    return typeof window !== "undefined";
  }
  /** True if we can actually speak this language on this device. */
  hasVoiceFor(lang: Lang) {
    return cloud?.ok !== false || this.browser.hasVoiceFor(lang);
  }
  async speak(text: string, lang: Lang): Promise<void> {
    this.cancel();
    const gen = ++this.generation;
    let failure: string | null = null;
    if (await checkCloudTts()) {
      try {
        const res = await fetch("/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: text.slice(0, 3000), lang }) });
        if (!res.ok) {
          const d = (await res.json().catch(() => ({}))) as { reason?: string; error?: string };
          throw new Error(d.reason && d.reason !== `agent-${res.status}` ? d.reason : d.error ?? `HTTP ${res.status}`);
        }
        const { audios, mime } = (await res.json()) as { audios: string[]; mime: string };
        if (!audios?.length) throw new Error("no audio returned");
        cloud = { ok: true, reason: null, at: Date.now() };
        useAssistant.getState().setTtsNotice(undefined);
        for (const b64 of audios) {
          if (gen !== this.generation) return; // cancelled / superseded
          await this.play(`data:${mime || "audio/wav"};base64,${b64}`);
        }
        this.lastEngine = "sarvam";
        return;
      } catch (e) {
        failure = (e as Error).message || "error";
        cloud = { ok: false, reason: failure, at: Date.now() };
      }
    } else failure = cloud?.reason ?? "unavailable";
    if (gen !== this.generation) return;
    const device = this.browser.isSupported() && this.browser.hasVoiceFor(lang);
    notify(failure, device);
    this.lastEngine = device ? "device" : "none";
    if (device) await this.browser.speak(text, lang);
  }
  private play(src: string) {
    return new Promise<void>((resolve, reject) => {
      const a = new Audio(src);
      this.audio = a;
      a.onended = () => resolve();
      a.onerror = () => reject(new Error("audio could not be decoded"));
      a.play().catch((e: Error) => reject(new Error(e?.name === "NotAllowedError" ? "browser blocked audio playback — tap the page and retry" : "audio playback failed")));
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
