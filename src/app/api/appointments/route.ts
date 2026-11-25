import { ApiError, json, withPatient } from "@/server/http";
import { prisma } from "@/server/db";
import { appointmentRequestSchema } from "@/lib/domain";
import { audit, channelOf } from "@/server/audit";

export const GET = withPatient(async (_req, user) => {
  const appointments = await prisma.appointment.findMany({
    where: { patientId: user.profile!.id },
    include: { facility: { select: { id: true, name: true, city: true, isDemo: true } } },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
  });
  return json({ appointments });
});

/** Creates a REQUEST only. It is never marked as booked/confirmed without a facility. */
export const POST = withPatient(async (req, user) => {
  if (req.headers.get("x-sv-channel") === "VOICE") throw new ApiError(403, "Appointment requests must be submitted by you, not by the assistant.", "HUMAN_SUBMIT_REQUIRED");
  const body = appointmentRequestSchema.parse(await req.json());
  const facility = await prisma.facility.findUnique({ where: { id: body.facilityId } });
  if (!facility) throw new ApiError(400, "Unknown facility", "VALIDATION");
  const date = new Date(`${body.preferredDate}T00:00:00+05:30`);
  if (date.getTime() < Date.now() - 864e5) throw new ApiError(400, "Preferred date must be today or later", "VALIDATION");
  const appt = await prisma.appointment.create({
    data: { patientId: user.profile!.id, facilityId: facility.id, department: body.department, preferredDate: date, status: "REQUESTED", notes: body.notes, isDemo: true },
    include: { facility: { select: { id: true, name: true, city: true, isDemo: true } } },
  });
  await audit({ userId: user.id, action: "APPOINTMENT_REQUESTED", entity: "Appointment", entityId: appt.id, channel: channelOf(req) });
  return json({ appointment: appt }, 201);
});
