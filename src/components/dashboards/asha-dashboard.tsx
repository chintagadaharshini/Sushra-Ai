import Link from "next/link";
import { HeartHandshake, MapPin, Mic, UserPlus, Users } from "lucide-react";
import { prisma } from "@/server/db";
import { listCarePatients } from "@/server/care";
import type { SessionUser } from "@/server/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TryCommand, OpenAssistantButton } from "@/components/app/try-command";
import { formatDate } from "@/lib/domain";

export async function AshaDashboard({ user }: { user: SessionUser }) {
  const a = user.ashaProfile!;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [patients, visits, registered] = await Promise.all([
    listCarePatients(user.id),
    prisma.healthRecord.findMany({ where: { authorUserId: user.id }, orderBy: { recordDate: "desc" }, take: 6, include: { patient: { select: { id: true, fullName: true } } } }),
    prisma.patientProfile.count({ where: { registeredByUserId: user.id } }),
  ]);
  const visitsThisMonth = visits.filter((v) => v.recordDate >= monthStart).length;
  const lastVisit = new Map<string, Date>();
  for (const v of visits) if (!lastVisit.has(v.patientId)) lastVisit.set(v.patientId, v.recordDate);
  const dueVisit = patients.filter((p) => {
    const last = lastVisit.get(p.patientId);
    return !last || Date.now() - +last > 30 * 864e5;
  });

  return (
    <div>
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-ink p-6 text-white md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-brand-400/30 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-sm font-semibold text-brand-200">ASHA workspace</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">Namaste, {a.fullName.split(" ")[0]} 🙏</h1>
            <p className="mt-2 flex items-center gap-1.5 text-slate-300"><MapPin className="size-4" aria-hidden />{a.village} · {a.phcName} · {a.district}</p>
            <div className="mt-3"><Badge className="bg-white/10 text-white">ASHA ID: {a.ashaId}</Badge></div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/patients/register" className="flex items-center gap-2 rounded-2xl bg-brand-500 px-5 py-4 font-bold text-ink hover:bg-brand-400"><UserPlus className="size-5" aria-hidden />Register a patient</Link>
            <OpenAssistantButton className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 pr-5 text-left ring-1 ring-white/20 hover:bg-white/15 cursor-pointer">
              <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-300 to-brand-600"><Mic className="size-6" aria-hidden /></span>
              <span><span className="block font-bold">Speak</span><span className="block text-sm text-brand-200">తెలుగు · हिन्दी</span></span>
            </OpenAssistantButton>
          </div>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "My patients", value: patients.length, icon: Users },
          { label: "Home visits this month", value: visitsThisMonth, icon: HeartHandshake },
          { label: "Patients I registered", value: registered, icon: UserPlus },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between"><p className="text-sm font-semibold text-muted">{label}</p><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-5" aria-hidden /></span></div>
            <p className="mt-1 text-2xl font-extrabold">{value}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="self-start xl:col-span-2">
          <CardHeader><CardTitle>Due for a home visit</CardTitle><Link href="/patients" className="text-sm font-semibold text-brand-700 hover:underline">All patients</Link></CardHeader>
          <CardContent className="space-y-2">
            {dueVisit.length === 0 && <p className="text-sm text-muted">Everyone has been visited in the last 30 days.</p>}
            {dueVisit.map((p) => (
              <Link key={p.patientId} href={`/patients/${p.patientId}`} className="flex items-center gap-4 rounded-xl border border-line px-4 py-3 hover:border-brand-300 hover:bg-brand-50/40">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-100 font-bold text-brand-800">{p.fullName[0]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.fullName}</span>
                  <span className="block text-sm text-muted">{p.gender} · {new Date().getFullYear() - p.yearOfBirth} y · {p.city ?? "—"}</span>
                </span>
                <span className="text-xs font-semibold text-warn">{lastVisit.get(p.patientId) ? `Last visit ${formatDate(lastVisit.get(p.patientId)!)}` : "Not visited yet"}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Recent visits</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {visits.length === 0 && <p className="text-sm text-muted">No visits recorded yet.</p>}
              {visits.map((v) => (
                <Link key={v.id} href={`/patients/${v.patientId}/records/${v.id}`} className="block rounded-xl border border-line p-3 hover:border-brand-300">
                  <p className="font-semibold">{v.patient.fullName}</p>
                  <p className="text-sm text-muted">{formatDate(v.recordDate)} · {v.summary.slice(0, 60)}</p>
                </Link>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Try a voice command</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <TryCommand cmd="నా రోగులను చూపించు" />
              <TryCommand cmd="కొత్త రోగిని నమోదు చేయి" />
              <TryCommand cmd="नया मरीज़ रजिस्टर करो" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
