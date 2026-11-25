import { json, withAuth } from "@/server/http";
import { prisma } from "@/server/db";
import { preferencePatchSchema } from "@/lib/domain";
import { audit, channelOf } from "@/server/audit";

export const GET = withAuth(async (_req, user) => json({ preferences: user.preferences }));

/** Only whitelisted, non-sensitive preference fields can be changed (strict schema). */
export const PATCH = withAuth(async (req, user) => {
  const patch = preferencePatchSchema.parse(await req.json());
  const preferences = await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: patch,
    create: { userId: user.id, ...patch },
  });
  await audit({ userId: user.id, action: `PREFERENCE_UPDATED:${Object.keys(patch).join(",")}`, entity: "UserPreference", channel: channelOf(req) });
  return json({ preferences });
});
