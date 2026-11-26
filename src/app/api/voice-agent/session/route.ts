import { z } from "zod";
import { json, withAuth } from "@/server/http";
import { mintVoiceToken, voiceAgentConfig, voiceAgentWsUrl } from "@/server/voice-agent";
import { displayNameOf } from "@/server/session";
import { audit } from "@/server/audit";
import { LANGS } from "@/lib/domain";

// Studio voice over WebSocket: the signed-in user gets a 2-minute token to open one
// connection directly to the voice agent (Render's proxy carries WebSockets, not WebRTC media).
const body = z.object({ lang: z.enum(LANGS).default("en") }).strict();

export const POST = withAuth(async (req, user) => {
  if (!voiceAgentConfig().secret) return json({ error: "Voice agent not configured", reason: "not-configured" }, 503);
  const { lang } = body.parse(await req.json().catch(() => ({})));
  const name = displayNameOf(user).split(" ")[0] ?? "";
  await audit({ userId: user.id, action: "STUDIO_VOICE_SESSION", channel: "VOICE" });
  return json({ wsUrl: voiceAgentWsUrl(), token: mintVoiceToken({ uid: user.id, name, role: user.role, lang }) });
});
