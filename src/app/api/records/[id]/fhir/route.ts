import { ApiError, withAuth } from "@/server/http";
import { getRecordForViewer } from "@/server/care";
import { prisma } from "@/server/db";
import { recordToFhirBundle } from "@/lib/fhir";
import { audit, channelOf } from "@/server/audit";

export const GET = withAuth<{ params: Promise<{ id: string }> }>(async (req, user, { params }) => {
  const { id } = await params;
  const record = await getRecordForViewer(user, id);
  if (!record) throw new ApiError(404, "Record not found", "NOT_FOUND");
  const owner = await prisma.healthRecord.findUnique({ where: { id }, select: { patient: true } });
  const p = owner!.patient;
  const bundle = recordToFhirBundle(record, { id: p.id, name: p.fullName, gender: p.gender, birthYear: p.yearOfBirth });
  await audit({ userId: user.id, action: "FHIR_EXPORT", entity: "HealthRecord", entityId: id, channel: channelOf(req) });
  return new Response(JSON.stringify(bundle, null, 2), {
    headers: { "content-type": "application/fhir+json", "content-disposition": `attachment; filename="record-${id}.fhir.json"`, "cache-control": "no-store" },
  });
});
