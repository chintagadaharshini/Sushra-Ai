import { z } from "zod";
import { json, withAuth } from "@/server/http";
import { forwardToAgent } from "@/server/voice-agent";
import { audit } from "@/server/audit";
import { LANGS } from "@/lib/domain";

// The browser only talks to this app. We check the session, then relay WebRTC signalling
// to the Pipecat agent with a shared secret. The agent never receives patient data from here.
const offer = z.object({ sdp: z.string().max(20000), type: z.string().max(20), pc_id: z.string().max(100).nullish(), restart_pc: z.boolean().nullish(), requestData: z.object({ lang: z.enum(LANGS) }).partial().nullish() }).passthrough();

export const POST = withAuth(async (req, user) => {
  const body = offer.parse(await req.json());
  const lang = body.requestData?.lang ?? "en";
  await audit({ userId: user.id, action: "STUDIO_VOICE_SESSION", channel: "VOICE" });
  return forwardToAgent("/api/offer", {
    method: "POST",
    body: JSON.stringify({ sdp: body.sdp, type: body.type, pc_id: body.pc_id ?? undefined, restart_pc: body.restart_pc ?? undefined, request_data: { lang, firstName: user.displayName, role: user.role } }),
  });
});

export const PATCH = withAuth(async (req) => {
  const body = await req.json();
  if (!body || typeof body !== "object") return json({ error: "bad request" }, 400);
  return forwardToAgent("/api/offer", { method: "PATCH", body: JSON.stringify(body) });
});
