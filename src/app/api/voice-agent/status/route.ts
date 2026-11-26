import { json, withAuth } from "@/server/http";
import { agentErrorReason, voiceAgentConfig } from "@/server/voice-agent";

// Checks the Pipecat agent. On Render's free plan the agent sleeps after ~15 idle minutes and
// takes ~30-60 s to wake; this request itself wakes it, and the client polls while reason === "waking".
export const GET = withAuth(async () => {
  const { url, secret } = voiceAgentConfig();
  if (!secret) return json({ available: false, reason: "not-configured" });
  try {
    const r = await fetch(`${url}/health`, { headers: { "x-sv-secret": secret }, signal: AbortSignal.timeout(9000), cache: "no-store" });
    if (!r.ok) return json({ available: false, reason: agentErrorReason(r.status) });
    const d = (await r.json()) as { ok: boolean; keys: Record<string, boolean> };
    return json({ available: d.ok, reason: d.ok ? null : "missing-api-keys", keys: d.keys });
  } catch (e) {
    return json({ available: false, reason: agentErrorReason(null, e) });
  }
});
