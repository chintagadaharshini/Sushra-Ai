import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/server/session";
import { getHealthDataProvider } from "@/server/abdm";
import { audit } from "@/server/audit";
import { llmConfigured } from "@/server/llm";
import { RecordView } from "@/components/records/record-view";

export const metadata = { title: "Record details" };

export default async function RecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const record = await getHealthDataProvider().getRecord(user.profile!.id, id);
  if (!record) {
    await audit({ userId: user.id, action: "RECORD_VIEW", entity: "HealthRecord", entityId: id, outcome: "DENIED" });
    notFound();
  }
  await audit({ userId: user.id, action: "RECORD_VIEW", entity: "HealthRecord", entityId: id });
  return <RecordView record={record} backHref="/records" backLabel="All records" llmAvailable={llmConfigured()} />;
}
