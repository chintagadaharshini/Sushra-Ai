import { ApiError, json, withAuth } from "@/server/http";
import { getRecordForViewer } from "@/server/care";
import { audit, channelOf } from "@/server/audit";

export const GET = withAuth<{ params: Promise<{ id: string }> }>(async (req, user, { params }) => {
  const { id } = await params;
  const record = await getRecordForViewer(user, id);
  if (!record) {
    await audit({ userId: user.id, action: "RECORD_VIEW", entity: "HealthRecord", entityId: id, outcome: "DENIED", channel: channelOf(req) });
    // 404 (not 403) so the existence of other patients' records is not revealed
    throw new ApiError(404, "Record not found", "NOT_FOUND");
  }
  await audit({ userId: user.id, action: "RECORD_VIEW", entity: "HealthRecord", entityId: id, channel: channelOf(req) });
  return json({ record });
});
