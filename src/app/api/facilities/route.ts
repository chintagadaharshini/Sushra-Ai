import { json, withAuth } from "@/server/http";
import { getFacilityDirectory } from "@/server/abdm";
import { CITY_IDS, FACILITY_TYPES } from "@/lib/domain";

export const GET = withAuth(async (req) => {
  const url = new URL(req.url);
  const city = url.searchParams.get("city") ?? undefined;
  const type = url.searchParams.get("type") ?? undefined;
  const dir = getFacilityDirectory();
  const facilities = await dir.search({
    city: city && (CITY_IDS as readonly string[]).includes(city) ? city : undefined,
    facilityType: type && (FACILITY_TYPES as readonly string[]).includes(type) ? type : undefined,
    q: url.searchParams.get("q")?.slice(0, 80) ?? undefined,
    service: url.searchParams.get("service")?.slice(0, 40) ?? undefined,
  });
  return json({ facilities, dataMode: dir.mode });
});
