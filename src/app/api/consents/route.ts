import { z } from "zod";
import { ApiError, json, withPatient } from "@/server/http";
import { prisma } from "@/server/db";
import { audit, channelOf } from "@/server/audit";

export const GET = withPatient(async (_req, user) => {
  const consents = await prisma.consentRecord.findMany({ where: { patientId: user.profile.id }, orderBy: { createdAt: "desc" } });
  return json({ consents });
});

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("grant"), purpose: z.enum(["AI_REPORT_EXPLANATION"]) }).strict(),
  z.object({ action: z.literal("share"), granteeUserId: z.string().min(1).max(64), days: z.union([z.literal(30), z.literal(90), z.literal(180), z.literal(365)]) }).strict(),
  z.object({ action: z.literal("revoke"), id: z.string().min(1).max(64) }).strict(),
]);

export const POST = withPatient(async (req, user) => {
  // Consent is a human decision taken on screen, never by the voice assistant.
  if (req.headers.get("x-sv-channel") === "VOICE") return json({ error: "Consent must be given by you on screen.", code: "HUMAN_REQUIRED" }, 403);
  const body = schema.parse(await req.json());
  const patientId = user.profile.id;
  if (body.action === "grant") {
    const c = await prisma.consentRecord.create({
      data: { patientId, purpose: body.purpose, scope: "Lab values only (no name, IDs, dates or facility)", grantedTo: "Configured AI provider (server-side)", status: "GRANTED", recordedByUserId: user.id, expiresAt: new Date(Date.now() + 30 * 864e5) },
    });
    await audit({ userId: user.id, action: "CONSENT_GRANTED", entity: "ConsentRecord", entityId: c.id, channel: channelOf(req) });
    return json({ consent: c }, 201);
  }
  if (body.action === "share") {
    const grantee = await prisma.user.findUnique({ where: { id: body.granteeUserId }, include: { doctorProfile: true, ashaProfile: true } });
    if (!grantee || (grantee.role !== "DOCTOR" && grantee.role !== "ASHA")) throw new ApiError(400, "Choose a registered doctor or ASHA worker", "VALIDATION");
    // Replace any earlier active share with the same person
    await prisma.consentRecord.updateMany({ where: { patientId, grantedToUserId: grantee.id, purpose: "CARE_ACCESS", status: "GRANTED" }, data: { status: "REVOKED" } });
    const name = grantee.doctorProfile?.fullName ?? `${grantee.ashaProfile?.fullName} (ASHA)`;
    const c = await prisma.consentRecord.create({
      data: {
        patientId, purpose: "CARE_ACCESS", grantedToUserId: grantee.id, grantedTo: name, recordedByUserId: user.id, status: "GRANTED",
        scope: grantee.role === "DOCTOR" ? "All health records (view) and adding consultation notes" : "All health records (view) and recording home visits",
        expiresAt: new Date(Date.now() + body.days * 864e5),
      },
    });
    await audit({ userId: user.id, action: "CARE_ACCESS_GRANTED", entity: "ConsentRecord", entityId: c.id, channel: channelOf(req) });
    return json({ consent: c }, 201);
  }
  const existing = await prisma.consentRecord.findFirst({ where: { id: body.id, patientId } });
  if (!existing) return json({ error: "Not found" }, 404);
  const c = await prisma.consentRecord.update({ where: { id: existing.id }, data: { status: "REVOKED" } });
  await audit({ userId: user.id, action: existing.purpose === "CARE_ACCESS" ? "CARE_ACCESS_REVOKED" : "CONSENT_REVOKED", entity: "ConsentRecord", entityId: c.id, channel: channelOf(req) });
  return json({ consent: c });
});
