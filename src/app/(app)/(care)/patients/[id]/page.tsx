import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertCircle, ArrowLeft, ChevronRight, ShieldCheck, UserRound } from "lucide-react";
import { getSessionUser } from "@/server/session";
import { activeCareConsent } from "@/server/care";
import { getHealthDataProvider } from "@/server/abdm";
import { prisma } from "@/server/db";
import { audit } from "@/server/audit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RECORD_TYPE_LABEL, formatDate, sourceLabel } from "@/lib/domain";
import { CareEntryForms } from "./care-entry-forms";

export const metadata = { title: "Patient" };

export default async function CarePatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const consent = await activeCareConsent(user.id, id);
  if (!consent) {
    await audit({ userId: user.id, action: "PATIENT_VIEW", entity: "PatientProfile", entityId: id, outcome: "DENIED" });
    notFound();
  }
  const [patient, records] = await Promise.all([prisma.patientProfile.findUnique({ where: { id } }), getHealthDataProvider().listRecords(id)]);
  if (!patient) notFound();
  await audit({ userId: user.id, action: "PATIENT_VIEW", entity: "PatientProfile", entityId: id });
  const age = new Date().getFullYear() - patient.yearOfBirth;

  return (
    <div>
      <Link href="/patients" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"><ArrowLeft className="size-4" aria-hidden />My patients</Link>
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-3xl border border-line bg-white p-5 shadow-soft">
        <span className="grid size-16 place-items-center rounded-2xl bg-brand-100 text-2xl font-bold text-brand-800">{patient.fullName[0]}</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight" data-testid="patient-name">{patient.fullName}</h1>
          <p className="text-muted">{patient.gender} · {age} years · {patient.city ?? patient.state}{patient.bloodGroup ? ` · Blood group ${patient.bloodGroup}` : ""} · Health ID {patient.healthId}</p>
        </div>
        <Badge tone="brand"><ShieldCheck aria-hidden />Shared with you{consent.expiresAt ? ` until ${formatDate(consent.expiresAt)}` : ""}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader><CardTitle>Health records</CardTitle><span className="text-sm text-muted">{records.length} total</span></CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {records.map((r) => (
                <li key={r.id}>
                  <Link href={`/patients/${id}/records/${r.id}`} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 hover:border-brand-300 hover:bg-brand-50/40">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{r.title}</span>
                      <span className="block text-sm text-muted">{formatDate(r.recordDate)} · {r.facilityName}</span>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        <Badge>{RECORD_TYPE_LABEL[r.recordType]}</Badge>
                        <Badge tone={r.authorType === "PATIENT" ? "warn" : "neutral"}><UserRound aria-hidden />{sourceLabel(r)}</Badge>
                        {r.abnormalCount > 0 && <Badge tone="warn"><AlertCircle aria-hidden />{r.abnormalCount} outside lab range</Badge>}
                      </span>
                    </span>
                    <ChevronRight className="size-5 text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
        <div className="xl:col-span-2">
          <CareEntryForms patientId={id} role={user.role === "DOCTOR" ? "DOCTOR" : "ASHA"} patientName={patient.fullName} />
        </div>
      </div>
    </div>
  );
}
