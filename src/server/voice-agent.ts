import "server-only";
import { createHmac } from "node:crypto";

export function voiceAgentConfig() {
  return {
    url: (process.env.VOICE_AGENT_URL || "http://127.0.0.1:7860").replace(/\/$/, ""),
    secret: process.env.VOICE_AGENT_SHARED_SECRET || "",
  };
}

/** Browser-facing WebSocket URL of the agent (http→ws, https→wss). */
export function voiceAgentWsUrl() {
  const base = (process.env.VOICE_AGENT_PUBLIC_URL || voiceAgentConfig().url).replace(/\/$/, "");
  return `${base.replace(/^http/, "ws")}/ws`;
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/**
 * Short-lived token that lets this signed-in user open one Studio voice WebSocket directly
 * to the agent. Format: base64url(JSON) + "." + base64url(HMAC-SHA256(secret, payload)).
 * Verified by voice-agent/server.py (verify_session_token). Carries no health data.
 */
export function mintVoiceToken(claims: { uid: string; name: string; role: string; lang: string }, ttlSeconds = 120) {
  const { secret } = voiceAgentConfig();
  if (!secret) throw new Error("VOICE_AGENT_SHARED_SECRET missing");
  const payload = b64url(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  const sig = b64url(createHmac("sha256", secret).update(payload).digest());
  return `${payload}.${sig}`;
}

const isTimeout = (e: unknown) => e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");

/** Render free-tier services sleep; their proxy answers 502/503 (or holds the request) while waking. */
export function agentErrorReason(status: number | null, e?: unknown): string {
  if (status === 502 || status === 503 || status === 504 || isTimeout(e)) return "waking";
  if (status === 401) return "secret-mismatch";
  if (status !== null) return `agent-${status}`;
  return "unreachable";
}

export async function forwardToAgent(path: string, init: RequestInit & { timeoutMs?: number }) {
  const { url, secret } = voiceAgentConfig();
  if (!secret) return new Response(JSON.stringify({ error: "Voice agent not configured (VOICE_AGENT_SHARED_SECRET missing)", reason: "not-configured" }), { status: 503 });
  try {
    const res = await fetch(`${url}${path}`, {
      ...init,
      headers: { "content-type": "application/json", "x-sv-secret": secret, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(init.timeoutMs ?? 15000),
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      let detail: unknown = text.slice(0, 300);
      try {
        detail = (JSON.parse(text) as { detail?: unknown }).detail ?? detail;
      } catch {
        /* not JSON (e.g. Render's own error page) */
      }
      return Response.json({ error: typeof detail === "string" ? detail : "Voice agent error", reason: agentErrorReason(res.status) }, { status: res.status === 401 ? 502 : res.status, headers: { "cache-control": "no-store" } });
    }
    return new Response(text, { status: res.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: "Voice agent is not reachable", reason: agentErrorReason(null, e) }, { status: 503 });
  }
}
