import { z } from "zod";
import { json, withAuth } from "@/server/http";
import { audit } from "@/server/audit";

// Voice actions are logged by intent name only — never the transcript.
const schema = z
  .object({
    action: z.string().regex(/^[A-Z_:]{3,40}$/),
    outcome: z.enum(["SUCCESS", "DENIED", "FAILED"]),
    entityId: z.string().max(64).optional(),
  })
  .strict();

export const POST = withAuth(async (req, user) => {
  const b = schema.parse(await req.json());
  await audit({ userId: user.id, action: b.action, entityId: b.entityId, outcome: b.outcome, channel: "VOICE" });
  return json({ ok: true });
});
