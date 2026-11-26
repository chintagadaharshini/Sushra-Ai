import { prisma } from "@/server/db";
import { sessionSecretProblem } from "@/server/crypto";
import { voiceAgentConfig } from "@/server/voice-agent";

// Public deployment check (Render health check + manual verification). Reports only booleans
// and counts, never secret values or personal data.
export const dynamic = "force-dynamic";

export async function GET() {
  let db = false;
  let demoAccounts = 0;
  try {
    demoAccounts = await prisma.user.count({ where: { isDemo: true } });
    db = true;
  } catch {
    db = false;
  }
  const { secret, url } = voiceAgentConfig();
  const body = {
    ok: db && !sessionSecretProblem(),
    db,
    demoAccounts,
    sessionSecret: !sessionSecretProblem(),
    voiceAgent: { sharedSecret: Boolean(secret), url: process.env.VOICE_AGENT_URL ? (url.startsWith("https://") ? "https" : "set") : "missing" },
  };
  return Response.json(body, { status: db ? 200 : 503, headers: { "cache-control": "no-store" } });
}
