import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/server/session";
import { activeCareConsent } from "@/server/care";
import { getHealthDataProvider } from "@/server/abdm";
import { prisma } from "@/server/db";
import { audit } from "@/server/audit";
import { RecordView } from "@/components/records/record-view";

export const metadata = { title: "Patient record" };

export default async function CareRecordPage({ params }: { params: Promise<{ id: string; rid: string }> }) {
  const { id, rid } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!(await activeCareConsent(user.id, id))) notFound();
  const [record, patient] = await Promise.all([getHealthDataProvider().getRecord(id, rid), prisma.patientProfile.findUnique({ where: { id }, select: { fullName: true } })]);
  if (!record) notFound();
  await audit({ userId: user.id, action: "RECORD_VIEW", entity: "HealthRecord", entityId: rid });
  return <RecordView record={record} backHref={`/patients/${id}`} backLabel={patient?.fullName ?? "Patient"} llmAvailable={false} patientName={patient?.fullName} />;
}
