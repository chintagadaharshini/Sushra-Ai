"use client";
// "Studio voice": real-time conversation with the Pipecat agent (Sarvam Saaras STT,
// Groq LLM with tools, Sarvam Bulbul TTS) over WebRTC. Optional — the browser
// speech mode keeps working without it.
import { useCallback, useEffect, useRef, useState } from "react";
import { useAssistant } from "@/lib/voice/store";

export type StudioState = "unavailable" | "checking" | "idle" | "connecting" | "connected" | "error";

type AnyClient = {
  startBotAndConnect?: unknown;
  connect: (p: unknown) => Promise<unknown>;
  disconnect: () => Promise<void>;
  sendClientMessage: (t: string, d?: unknown) => void;
};

export function useStudioVoice(runAgentAction: (action: unknown) => Promise<Record<string, unknown>>) {
  const [state, setState] = useState<StudioState>("checking");
  const [reason, setReason] = useState<string | null>(null);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [botSpeaking, setBotSpeaking] = useState(false);
  /** Browser refused to auto-play the bot's audio; user must tap once to enable sound. */
  const [audioBlocked, setAudioBlocked] = useState(false);
  const botAudio = useRef<HTMLAudioElement | null>(null);
  const client = useRef<AnyClient | null>(null);
  const botMsg = useRef<string | null>(null);
  const lastBotText = useRef<string | null>(null);
  const runRef = useRef(runAgentAction);
  runRef.current = runAgentAction;

  const check = useCallback(async () => {
    try {
      const r = await fetch("/api/voice-agent/status");
      const d = (await r.json()) as { available: boolean; reason?: string };
      setState(d.available ? "idle" : "unavailable");
      setReason(d.available ? null : d.reason ?? "unavailable");
    } catch {
      setState("unavailable");
      setReason("unreachable");
    }
  }, []);
  useEffect(() => void check(), [check]);

  /**
   * The Pipecat SmallWebRTC transport delivers the bot's voice as a remote WebRTC audio
   * track but does NOT play it — the app has to attach it to an <audio> element.
   * (Without this, Sarvam audio arrives but is never heard.)
   */
  const ensureAudioElement = useCallback(() => {
    if (botAudio.current) return botAudio.current;
    const el = document.createElement("audio");
    el.autoplay = true;
    el.setAttribute("playsinline", "");
    el.setAttribute("data-testid", "studio-bot-audio");
    el.style.display = "none";
    document.body.appendChild(el);
    botAudio.current = el;
    return el;
  }, []);

  const playBotTrack = useCallback(
    (track: MediaStreamTrack) => {
      const el = ensureAudioElement();
      const current = (el.srcObject as MediaStream | null)?.getAudioTracks()[0];
      if (current?.id !== track.id) el.srcObject = new MediaStream([track]);
      el.play().then(
        () => setAudioBlocked(false),
        () => setAudioBlocked(true), // autoplay policy — show "tap to hear" button
      );
    },
    [ensureAudioElement],
  );

  const enableSound = useCallback(() => {
    void botAudio.current?.play().then(() => setAudioBlocked(false), () => setAudioBlocked(true));
  }, []);

  const releaseAudio = useCallback(() => {
    const el = botAudio.current;
    if (!el) return;
    el.pause();
    el.srcObject = null;
    el.remove();
    botAudio.current = null;
    setAudioBlocked(false);
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await client.current?.disconnect();
    } finally {
      releaseAudio();
      client.current = null;
      setState((s) => (s === "unavailable" ? s : "idle"));
      setUserSpeaking(false);
      setBotSpeaking(false);
    }
  }, []);

  const connect = useCallback(async () => {
    const S = useAssistant.getState;
    setState("connecting");
    // Create + "unlock" the audio element inside the user's tap so autoplay is allowed later.
    const el = ensureAudioElement();
    void el.play().catch(() => {});
    try {
      const [{ PipecatClient }, { SmallWebRTCTransport, WavMediaManager }] = await Promise.all([import("@pipecat-ai/client-js"), import("@pipecat-ai/small-webrtc-transport")]);
      // Default: the library's WebRTC device manager. It plays the bot through a WebRTC audio
      // element, so the browser's echo cancellation removes the bot's own voice from the mic.
      // NEXT_PUBLIC_PIPECAT_MEDIA_MANAGER=local uses a WebAudio player instead (no CDN script,
      // but weaker echo cancellation — use headphones).
      const useLocal = process.env.NEXT_PUBLIC_PIPECAT_MEDIA_MANAGER === "local";
      const c = new PipecatClient({
        transport: new SmallWebRTCTransport(useLocal ? { mediaManager: new WavMediaManager() } : {}),
        enableMic: true,
        enableCam: false,
        callbacks: {
          onTrackStarted: (track: MediaStreamTrack, participant?: { local?: boolean }) => {
            // Local mic tracks are reported with participant.local === true; the bot's track has no/remote participant.
            if (track.kind === "audio" && !participant?.local) playBotTrack(track);
          },
          onTrackStopped: (track: MediaStreamTrack, participant?: { local?: boolean }) => {
            if (track.kind !== "audio" || participant?.local) return;
            const el = botAudio.current;
            if (el && (el.srcObject as MediaStream | null)?.getAudioTracks()[0]?.id === track.id) el.pause();
          },
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
          onBotOutput: (d: { text: string; spoken_status?: string; output_type?: string; aggregated_by?: string }) => {
            // Each sentence is reported when generated ("new") and again as it is spoken
            // ("in-progress"/"completed"); show it once.
            if (d.spoken_status && d.spoken_status !== "new") return;
            const text = d.text?.trim();
            if (!text || text === lastBotText.current) return; // guard against repeated reports
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
          onDisconnected: () => {
            client.current = null;
            releaseAudio();
            setState((s) => (s === "unavailable" ? s : "idle"));
          },
        },
      }) as unknown as AnyClient;
      client.current = c;
      await c.connect({ webrtcRequestParams: { endpoint: "/api/voice-agent/offer", requestData: { lang: S().lang } } });
      setState("connected");
    } catch (e) {
      client.current = null;
      releaseAudio();
      setState("error");
      setReason((e as Error)?.message ?? "connection failed");
    }
  }, [ensureAudioElement, playBotTrack, releaseAudio]);

  useEffect(
    () => () => {
      void client.current?.disconnect();
      releaseAudio();
    },
    [releaseAudio],
  );

  return { state, reason, connect, disconnect, recheck: check, userSpeaking, botSpeaking, audioBlocked, enableSound };
}
