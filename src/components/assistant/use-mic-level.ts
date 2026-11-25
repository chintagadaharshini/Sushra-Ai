"use client";
import { useEffect, useState } from "react";

/**
 * Real microphone level (0..1) for the waveform — only while `active` (i.e. while the
 * user has explicitly started listening). Audio is analysed in memory and never recorded.
 */
export function useMicLevel(active: boolean): number {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setLevel(0);
      return;
    }
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let raf = 0;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(s);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        // Throttled: at most ~15 state updates per second, and only when the level visibly
        // changes. Updating React state on every animation frame (60/s) floods renders.
        let last = 0;
        let lastAt = 0;
        const tick = (now: number) => {
          if (cancelled) return;
          if (now - lastAt >= 66) {
            analyser.getByteTimeDomainData(data);
            let sum = 0;
            for (const v of data) sum += ((v - 128) / 128) ** 2;
            const next = Math.round(Math.min(1, Math.sqrt(sum / data.length) * 4) * 20) / 20; // 0.05 steps
            if (next !== last) {
              last = next;
              setLevel(next);
            }
            lastAt = now;
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      })
      .catch(() => setLevel(0)); // visual only; recognition reports its own permission errors
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close();
      setLevel(0);
    };
  }, [active]);
  return level;
}
