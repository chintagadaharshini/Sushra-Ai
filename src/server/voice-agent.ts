import "server-only";

export function voiceAgentConfig() {
  return {
    url: (process.env.VOICE_AGENT_URL || "http://127.0.0.1:7860").replace(/\/$/, ""),
    secret: process.env.VOICE_AGENT_SHARED_SECRET || "",
  };
}

export async function forwardToAgent(path: string, init: RequestInit & { timeoutMs?: number }) {
  const { url, secret } = voiceAgentConfig();
  if (!secret) return new Response(JSON.stringify({ error: "Voice agent not configured (VOICE_AGENT_SHARED_SECRET missing)" }), { status: 503 });
  try {
    const res = await fetch(`${url}${path}`, {
      ...init,
      headers: { "content-type": "application/json", "x-sv-secret": secret, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(init.timeoutMs ?? 15000),
      cache: "no-store",
    });
    return new Response(await res.text(), { status: res.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch {
    return new Response(JSON.stringify({ error: "Voice agent is not reachable" }), { status: 503 });
  }
}
