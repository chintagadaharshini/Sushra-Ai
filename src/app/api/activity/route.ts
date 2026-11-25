import { json, withAuth } from "@/server/http";
import { prisma } from "@/server/db";

export const GET = withAuth(async (_req, user) => {
  const events = await prisma.auditEvent.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 15 });
  return json({ events });
});
