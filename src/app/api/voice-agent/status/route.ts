import { json, withAuth } from "@/server/http";
import { voiceAgentConfig } from "@/server/voice-agent";

export const GET = withAuth(async () => {
  const { url, secret } = voiceAgentConfig();
  if (!secret) return json({ available: false, reason: "not-configured" });
  try {
    const r = await fetch(`${url}/health`, { headers: { "x-sv-secret": secret }, signal: AbortSignal.timeout(2500), cache: "no-store" });
    if (!r.ok) return json({ available: false, reason: `agent-${r.status}` });
    const d = (await r.json()) as { ok: boolean; keys: Record<string, boolean> };
    return json({ available: d.ok, reason: d.ok ? null : "missing-api-keys", keys: d.keys });
  } catch {
    return json({ available: false, reason: "unreachable" });
  }
});
