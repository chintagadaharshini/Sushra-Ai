import { json, withPatient } from "@/server/http";
import { getHealthDataProvider } from "@/server/abdm";
import { RECORD_TYPES } from "@/lib/domain";

export const GET = withPatient(async (req, user) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? undefined;
  const records = await getHealthDataProvider().listRecords(user.profile!.id, {
    recordType: type && (RECORD_TYPES as readonly string[]).includes(type) ? type : undefined,
    category: url.searchParams.get("category") ?? undefined,
    q: url.searchParams.get("q")?.slice(0, 80) ?? undefined,
  });
  return json({ records, dataMode: getHealthDataProvider().mode });
});
