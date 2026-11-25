import { json, withAuth } from "@/server/http";
import { listCarePatients } from "@/server/care";

export const GET = withAuth(async (req, user) => {
  const q = new URL(req.url).searchParams.get("q")?.slice(0, 60) ?? undefined;
  return json({ patients: await listCarePatients(user.id, q) });
}, ["DOCTOR", "ASHA"]);
