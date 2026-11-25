import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, ShieldCheck, UserPlus } from "lucide-react";
import { getSessionUser } from "@/server/session";
import { listCarePatients } from "@/server/care";
import { PageHeader } from "@/components/app/page-header";
import { TryCommand } from "@/components/app/try-command";
import { CarePatientsVoiceContext } from "./voice-context";
import { formatDate } from "@/lib/domain";

export const metadata = { title: "My patients" };

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { q } = await searchParams;
  const patients = await listCarePatients(user.id, q);
  return (
    <div>
      <CarePatientsVoiceContext ids={patients.map((p) => p.patientId)} />
      <PageHeader title="My patients" subtitle="Patients who have chosen to share their records with you. Access ends when they revoke it or it expires.">
        {user.role === "ASHA" && (
          <Link href="/patients/register" className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700"><UserPlus className="size-4" aria-hidden />Register patient</Link>
        )}
        <TryCommand cmd={user.role === "ASHA" ? "నా రోగులను చూపించు" : "Open my patients"} />
      </PageHeader>
      <form className="relative mb-5" role="search">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted" aria-hidden />
        <input name="q" defaultValue={q} aria-label="Search patients" placeholder="Search by name, city or Health ID" className="h-12 w-full rounded-xl border border-line bg-white pl-10 pr-3 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" />
      </form>
      {patients.length === 0 && <p className="rounded-2xl border border-line bg-white p-8 text-center text-muted">{q ? "No patients match." : "No patients are sharing their records with you yet."}</p>}
      <ol className="space-y-2.5">
        {patients.map((p, i) => (
          <li key={p.patientId}>
            <Link href={`/patients/${p.patientId}`} data-testid="patient-row" className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-white p-4 shadow-soft hover:border-brand-300">
              <span className="hidden w-6 text-center text-sm font-bold text-muted sm:block">{i + 1}</span>
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-100 text-lg font-bold text-brand-800">{p.fullName[0]}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{p.fullName}</span>
                <span className="block text-sm text-muted">{p.gender} · {new Date().getFullYear() - p.yearOfBirth} years · {p.city ?? "—"} · Health ID {p.healthId}</span>
              </span>
              <span className="text-right text-xs text-muted">
                <span className="flex items-center justify-end gap-1 font-semibold text-brand-700"><ShieldCheck className="size-3.5" aria-hidden />Shared{p.accessUntil ? ` until ${formatDate(p.accessUntil)}` : ""}</span>
                {p.recordCount} records{p.lastRecord ? ` · last ${formatDate(p.lastRecord.date)}` : ""}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
