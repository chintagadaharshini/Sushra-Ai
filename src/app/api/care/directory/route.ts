import { json, withPatient } from "@/server/http";
import { prisma } from "@/server/db";

/** Registered doctors and ASHA workers a patient can choose to share records with. */
export const GET = withPatient(async (req) => {
  const q = new URL(req.url).searchParams.get("q")?.trim().toLowerCase().slice(0, 60) ?? "";
  const [doctors, ashas] = await Promise.all([
    prisma.doctorProfile.findMany({ orderBy: { fullName: "asc" }, take: 200 }),
    prisma.ashaProfile.findMany({ orderBy: { fullName: "asc" }, take: 200 }),
  ]);
  const people = [
    ...doctors.map((d) => ({ userId: d.userId, role: "DOCTOR" as const, name: d.fullName, detail: `${d.specialization} · ${d.facilityName}`, city: d.city, verified: d.verificationStatus === "VERIFIED" })),
    ...ashas.map((a) => ({ userId: a.userId, role: "ASHA" as const, name: a.fullName, detail: `ASHA · ${a.village} · ${a.phcName}`, city: a.district, verified: true })),
  ].filter((p) => !q || `${p.name} ${p.detail} ${p.city}`.toLowerCase().includes(q));
  return json({ people });
});
