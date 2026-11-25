import { z } from "zod";
import { ApiError, json, withPatient } from "@/server/http";
import { prisma } from "@/server/db";
import { audit, channelOf } from "@/server/audit";

const schema = z.object({ action: z.literal("cancel") }).strict();

export const PATCH = withPatient<{ params: Promise<{ id: string }> }>(async (req, user, { params }) => {
  const { id } = await params;
  schema.parse(await req.json());
  const appt = await prisma.appointment.findFirst({ where: { id, patientId: user.profile!.id } });
  if (!appt) throw new ApiError(404, "Appointment not found", "NOT_FOUND");
  if (appt.status === "CANCELLED" || appt.status === "COMPLETED") throw new ApiError(409, "This appointment can't be cancelled", "CONFLICT");
  const updated = await prisma.appointment.update({ where: { id }, data: { status: "CANCELLED" } });
  await audit({ userId: user.id, action: "APPOINTMENT_CANCELLED", entity: "Appointment", entityId: id, channel: channelOf(req) });
  return json({ appointment: updated });
});
