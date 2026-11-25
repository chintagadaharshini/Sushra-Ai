"use client";
// Wires the pure executor to the real app: router, API, forms, speech.
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAssistant } from "@/lib/voice/store";
import { executeIntent, handleUtterance, type ExecDeps, type TurnResult } from "@/lib/voice/executor";
import { formRegistry } from "@/lib/voice/form-bridge";
import { WebSpeechRecognizer, SPEECH_ERROR_TEXT, type SpeechErrorCode } from "@/lib/voice/speech";
import { checkCloudTts, speaker } from "@/lib/voice/tts";
import { intentSchema, type Intent } from "@/lib/voice/intents";
import { LANG_META, type Lang, type RecordSummaryDTO } from "@/lib/domain";
import type { Explanation } from "@/lib/explain";

const VOICE_HEADERS = { "content-type": "application/json", "x-sv-channel": "VOICE" };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...VOICE_HEADERS, ...(init?.headers ?? {}) } });
  if (res.status === 401) throw new Error("UNAUTHENTICATED");
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  return res.json() as Promise<T>;
}

function waitFor(pred: () => boolean, timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    if (pred()) return resolve(true);
    const start = Date.now();
    const iv = setInterval(() => {
      if (pred()) {
        clearInterval(iv);
        resolve(true);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(iv);
        resolve(false);
      }
    }, 80);
  });
}

function scrollPage(dir: "up" | "down" | "top" | "bottom"): "moved" | "at-top" | "at-bottom" {
  const y = window.scrollY;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if ((dir === "down" || dir === "bottom") && y >= max - 4) return "at-bottom";
  if ((dir === "up" || dir === "top") && y <= 4) return "at-top";
  const step = Math.round(window.innerHeight * 0.7);
  const top = dir === "down" ? y + step : dir === "up" ? y - step : dir === "top" ? 0 : max;
  window.scrollTo({ top, behavior: "smooth" });
  return "moved";
}

export function useAssistantEngine() {
  const router = useRouter();
  const recognizer = useMemo(() => new WebSpeechRecognizer(), []);
  const synth = useMemo(() => speaker(), []);
  const busy = useRef(false);
  const notifiedNoVoice = useRef<Set<Lang>>(new Set());

  const deps = useMemo<ExecDeps>(() => {
    const S = () => useAssistant.getState();
    return {
      get lang() {
        return S().lang;
      },
      get ctx() {
        return S().ctx;
      },
      setCtx: (p) => S().setCtx(p),
      setLang: (l) => S().setLang(l),
      role: () => S().role,
      pathname: () => S().pathname,
      navigate: (p) => router.push(p),
      back: () => router.back(),
      waitFor,
      scroll: scrollPage,
      forms: { get: (id) => formRegistry.get(id) },
      facilityResult: () => S().facilityResult,
      onExplanation: (e) => S().setExplanation(e),
      api: {
        listRecords: async () => (await api<{ records: RecordSummaryDTO[] }>("/api/records")).records,
        explain: async (id: string, lang: Lang) =>
          (await api<{ explanation: Explanation }>(`/api/records/${id}/explain`, { method: "POST", body: JSON.stringify({ lang, mode: "deterministic" }) })).explanation,
        audit: (action, outcome, entityId) => {
          void fetch("/api/audit", { method: "POST", headers: VOICE_HEADERS, body: JSON.stringify({ action, outcome, ...(entityId ? { entityId } : {}) }) }).catch(() => {});
        },
        interpret: async (text: string, lang: Lang): Promise<Intent | null> => {
          const r = await api<{ configured: boolean; intent: unknown }>("/api/assistant/interpret", { method: "POST", body: JSON.stringify({ text: text.slice(0, 300), lang }) });
          if (!r.configured || !r.intent) return null;
          const parsed = intentSchema.safeParse(r.intent);
          return parsed.success ? parsed.data : null;
        },
      },
      now: () => Date.now(),
    };
  }, [router]);

  const speak = useCallback(
    async (text: string, lang: Lang) => {
      const s = useAssistant.getState();
      if (!s.voiceOn || !synth.isSupported()) return;
      await checkCloudTts();
      if (!synth.hasVoiceFor(lang) && !notifiedNoVoice.current.has(lang)) {
        notifiedNoVoice.current.add(lang);
        s.setTtsNotice(`This device has no ${LANG_META[lang].label} voice. Start the voice service (Sarvam) for spoken ${LANG_META[lang].label} replies; the text is shown here.`);
      }
      s.setStatus("speaking");
      await synth.speak(text, lang);
      const st = useAssistant.getState();
      if (st.status === "speaking") st.setStatus(st.ctx.pending ? (st.ctx.pending.kind === "confirm" ? "awaiting-confirmation" : "awaiting-choice") : "idle");
    },
    [synth],
  );

  const process = useCallback(
    async (text: string, display?: string) => {
      const s = useAssistant.getState();
      const clean = text.trim();
      if (!clean || busy.current) return;
      busy.current = true;
      synth.cancel(); // a new command interrupts the previous spoken reply
      s.setInterim("");
      s.addMessage({ role: "user", text: display ?? clean, lang: s.lang });
      s.setStatus("processing");
      let reply: { text: string; lang: Lang } | null = null;
      try {
        const result = await handleUtterance(clean, deps);
        s.addMessage({ role: "assistant", text: result.say, lang: result.sayLang, tone: result.tone, explanation: result.explanation, pending: result.pending });
        reply = { text: result.say, lang: result.sayLang };
      } catch {
        s.addMessage({ role: "assistant", text: "Sorry, something went wrong. Nothing was changed.", lang: "en", tone: "error" });
      } finally {
        busy.current = false;
        const st = useAssistant.getState();
        const p = st.ctx.pending;
        // Any pending prompt that is no longer the active one becomes read-only
        for (const m of st.messages) if (m.pending && !m.resolved && m.pending !== p) st.resolveMessage(m.id);
        useAssistant.getState().setStatus(p ? (p.kind === "confirm" ? "awaiting-confirmation" : "awaiting-choice") : "idle");
      }
      // Speak without blocking: the user can give the next command while the reply plays.
      if (reply) void speak(reply.text, reply.lang);
    },
    [deps, speak, synth],
  );

  /**
   * Runs an action requested by the Pipecat voice agent (Studio voice). Same guarded
   * executor as typed/spoken commands; returns the verified outcome to the agent.
   */
  const runAgentAction = useCallback(
    async (action: unknown): Promise<Record<string, unknown>> => {
      const s = useAssistant.getState();
      const a = action as { kind?: string; text?: unknown; intent?: unknown };
      let result: TurnResult;
      if (a?.kind === "reply" && typeof a.text === "string" && /^(yes|no|[1-5])$/.test(a.text)) {
        result = await handleUtterance(a.text, deps);
      } else if (a?.kind === "intent") {
        const parsed = intentSchema.safeParse(a.intent);
        if (!parsed.success || parsed.data.type === "UNKNOWN") return { ok: false, error: "Rejected: invalid action" };
        result = await executeIntent(parsed.data, deps);
      } else {
        return { ok: false, error: "Rejected: unknown action" };
      }
      // Show cards (confirmation / choices / explanation) in the panel; the agent speaks.
      if (result.pending || result.explanation || result.tone === "error" || result.tone === "warning") {
        s.addMessage({ role: "assistant", text: result.say, lang: result.sayLang, tone: result.tone, explanation: result.explanation, pending: result.pending });
      }
      const st = useAssistant.getState();
      for (const m of st.messages) if (m.pending && !m.resolved && m.pending !== st.ctx.pending) st.resolveMessage(m.id);
      return {
        ok: result.tone !== "error",
        say: result.say,
        language: result.sayLang,
        awaiting: result.pending ? (result.pending.kind === "confirm" ? "user confirmation (yes/no)" : `user choice among ${result.pending.options.length} options`) : null,
        explanation: result.explanation ? `${result.explanation.summary} ${result.explanation.caution}` : undefined,
      };
    },
    [deps],
  );

  const startListening = useCallback(() => {
    const s = useAssistant.getState();
    synth.cancel();
    if (!recognizer.isSupported()) {
      s.addMessage({ role: "assistant", text: SPEECH_ERROR_TEXT.unsupported[s.lang], lang: s.lang, tone: "warning" });
      return;
    }
    s.setOpen(true);
    s.setInterim("");
    recognizer.start(s.lang, {
      onStart: () => useAssistant.getState().setStatus("listening"),
      onInterim: (t) => useAssistant.getState().setInterim(t),
      onFinal: (t) => {
        void process(t);
      },
      onError: (code: SpeechErrorCode) => {
        if (code === "aborted") return;
        const st = useAssistant.getState();
        st.addMessage({ role: "assistant", text: SPEECH_ERROR_TEXT[code][st.lang], lang: st.lang, tone: code === "no-speech" ? "warning" : "error" });
      },
      onEnd: () => {
        const st = useAssistant.getState();
        if (st.status === "listening") st.setStatus(st.ctx.pending ? (st.ctx.pending.kind === "confirm" ? "awaiting-confirmation" : "awaiting-choice") : "idle");
        st.setInterim("");
      },
    });
  }, [recognizer, synth, process]);

  const stopListening = useCallback(() => recognizer.stop(), [recognizer]);
  const stopAll = useCallback(() => {
    recognizer.abort();
    synth.cancel();
    useAssistant.getState().setStatus("idle");
  }, [recognizer, synth]);

  // Process commands queued from buttons/chips elsewhere in the UI
  const queued = useAssistant((s) => s.queued);
  useEffect(() => {
    if (!queued) return;
    const q = useAssistant.getState().takeQueued();
    if (q) void process(q.text, q.display);
  }, [queued, process]);

  // Stop audio when leaving the app
  useEffect(() => () => stopAll(), [stopAll]);

  // Stable object identity: consumers use it in effect dependency lists.
  return useMemo(
    () => ({
      process,
      runAgentAction,
      startListening,
      stopListening,
      stopAll,
      speak,
      isRecognitionSupported: () => recognizer.isSupported(),
      isSynthesisSupported: () => synth.isSupported(),
    }),
    [process, runAgentAction, startListening, stopListening, stopAll, speak, recognizer, synth],
  );
}
