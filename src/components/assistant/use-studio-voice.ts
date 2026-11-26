"use client";
// "Studio voice": real-time conversation with the Pipecat agent (Sarvam Saaras STT,
// Groq LLM with tools, Sarvam Bulbul TTS). Audio and RTVI messages travel over one
// WebSocket, which works behind HTTP-only hosts such as Render (WebRTC media needs UDP,
// which Render does not route). The browser speech mode keeps working without it.
import { useCallback, useEffect, useRef, useState } from "react";
import { useAssistant } from "@/lib/voice/store";

export type StudioState = "unavailable" | "checking" | "waking" | "idle" | "connecting" | "connected" | "error";

type AnyClient = {
  connect: (p: unknown) => Promise<unknown>;
  disconnect: () => Promise<void>;
  sendClientMessage: (t: string, d?: unknown) => void;
};

type Status = { available: boolean; reason?: string | null };

const WAKE_POLL_MS = 5000;
const WAKE_MAX_MS = 120_000;

export function useStudioVoice(runAgentAction: (action: unknown) => Promise<Record<string, unknown>>) {
  const [state, setState] = useState<StudioState>("checking");
  const [reason, setReason] = useState<string | null>(null);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [botSpeaking, setBotSpeaking] = useState(false);
  const client = useRef<AnyClient | null>(null);
  const botMsg = useRef<string | null>(null);
  const lastBotText = useRef<string | null>(null);
  const runRef = useRef(runAgentAction);
  runRef.current = runAgentAction;
  const checkSeq = useRef(0);

  /** Checks the agent; while it is waking up (Render free plan), keeps polling for up to 2 minutes. */
  const check = useCallback(async () => {
    const seq = ++checkSeq.current;
    const started = Date.now();
    setState((s) => (s === "connected" || s === "connecting" ? s : "checking"));
    for (;;) {
      let d: Status;
      try {
        const r = await fetch("/api/voice-agent/status", { cache: "no-store" });
        d = r.ok ? ((await r.json()) as Status) : { available: false, reason: r.status === 401 ? "signed-out" : `app-${r.status}` };
      } catch {
        d = { available: false, reason: "network" };
      }
      if (seq !== checkSeq.current) return false; // superseded
      if (d.available) {
        setReason(null);
        setState((s) => (s === "connected" || s === "connecting" ? s : "idle"));
        return true;
      }
      if (d.reason === "waking" && Date.now() - started < WAKE_MAX_MS) {
        setReason("waking");
        setState("waking");
        await new Promise((r) => setTimeout(r, WAKE_POLL_MS));
        continue;
      }
      setReason(d.reason ?? "unavailable");
      setState("unavailable");
      return false;
    }
  }, []);
  useEffect(() => {
    void check();
    return () => void checkSeq.current++;
  }, [check]);

  const disconnect = useCallback(async () => {
    try {
      await client.current?.disconnect();
    } finally {
      client.current = null;
      setState((s) => (s === "unavailable" ? s : "idle"));
      setUserSpeaking(false);
      setBotSpeaking(false);
    }
  }, []);

  const connect = useCallback(async () => {
    const S = useAssistant.getState;
    setState("connecting");
    setReason(null);
    try {
      // Fresh 2-minute token for this signed-in user (the agent verifies it with the shared secret).
      const sres = await fetch("/api/voice-agent/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang: S().lang }) });
      if (!sres.ok) throw new Error(((await sres.json().catch(() => ({}))) as { reason?: string; error?: string }).reason ?? `session-${sres.status}`);
      const { wsUrl, token } = (await sres.json()) as { wsUrl: string; token: string };

      const [{ PipecatClient }, { WebSocketTransport, WavMediaManager, DailyMediaManager, ProtobufFrameSerializer }] = await Promise.all([
        import("@pipecat-ai/client-js"),
        import("@pipecat-ai/websocket-transport"),
      ]);
      // Default: WebAudio recorder/player (no external script). The agent mutes the mic while it
      // speaks, so speaker echo is not transcribed. NEXT_PUBLIC_PIPECAT_MEDIA_MANAGER=daily switches
      // to Daily's device manager (loads a script from Daily's CDN).
      const mediaManager =
        process.env.NEXT_PUBLIC_PIPECAT_MEDIA_MANAGER === "daily" ? new DailyMediaManager(true, true, undefined, undefined, 512, 16000, 24000) : new WavMediaManager(512, 16000);
      let serverError: string | null = null;
      const c = new PipecatClient({
        transport: new WebSocketTransport({ mediaManager, serializer: new ProtobufFrameSerializer(), recorderSampleRate: 16000, playerSampleRate: 24000 }),
        enableMic: true,
        enableCam: false,
        callbacks: {
          onUserStartedSpeaking: () => setUserSpeaking(true),
          onUserStoppedSpeaking: () => setUserSpeaking(false),
          onBotStartedSpeaking: () => setBotSpeaking(true),
          onBotStoppedSpeaking: () => {
            setBotSpeaking(false);
            botMsg.current = null;
          },
          onUserTranscript: (d: { text: string; final: boolean }) => {
            if (d.final && d.text.trim()) {
              S().setInterim("");
              botMsg.current = null;
              S().addMessage({ role: "user", text: d.text.trim(), lang: S().lang });
            } else S().setInterim(d.text);
          },
          onBotOutput: (d: { text: string; spoken_status?: string }) => {
            // Each sentence is reported when generated ("new") and again as it is spoken; show it once.
            if (d.spoken_status && d.spoken_status !== "new") return;
            const text = d.text?.trim();
            if (!text || text === lastBotText.current) return;
            lastBotText.current = text;
            const st = S();
            if (botMsg.current) {
              useAssistant.setState({ messages: st.messages.map((m) => (m.id === botMsg.current ? { ...m, text: `${m.text} ${text}` } : m)) });
            } else botMsg.current = st.addMessage({ role: "assistant", text, lang: st.lang });
          },
          onServerMessage: async (data: { type?: string; id?: string; action?: unknown }) => {
            if (data?.type !== "sv-action" || !data.id) return;
            let result: Record<string, unknown>;
            try {
              result = await runRef.current(data.action);
            } catch {
              result = { ok: false, error: "The app failed to perform the action." };
            }
            client.current?.sendClientMessage("sv-action-result", { id: data.id, result });
          },
          onError: (msg: { data?: unknown }) => {
            // Pipeline errors (e.g. Sarvam/Groq rejected a key) are reported here instead of failing silently.
            const d = (msg?.data ?? {}) as { message?: string; error?: string };
            serverError = d.message ?? d.error ?? "voice service error";
            S().addMessage({ role: "assistant", text: `Studio voice error: ${serverError}`, lang: S().lang, tone: "error" });
          },
          onDisconnected: () => {
            client.current = null;
            setUserSpeaking(false);
            setBotSpeaking(false);
            setState((s) => (s === "unavailable" ? s : serverError ? "error" : "idle"));
            if (serverError) setReason(serverError);
          },
        },
      }) as unknown as AnyClient;
      client.current = c;
      await c.connect({ wsUrl, token });
      setState("connected");
    } catch (e) {
      try {
        await client.current?.disconnect();
      } catch {
        /* already closed */
      }
      client.current = null;
      const msg = (e as Error)?.message ?? "connection failed";
      setReason(msg);
      setState("error");
      if (msg === "waking") void check();
    }
  }, [check]);

  useEffect(
    () => () => {
      void client.current?.disconnect();
    },
    [],
  );

  return { state, reason, connect, disconnect, recheck: check, userSpeaking, botSpeaking, audioBlocked: false, enableSound: () => {} };
}
