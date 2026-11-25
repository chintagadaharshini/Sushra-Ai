import Link from "next/link";
import { BadgeCheck, ClipboardList, Clock, FileHeart, Mic, Users } from "lucide-react";
import { prisma } from "@/server/db";
import { listCarePatients } from "@/server/care";
import type { SessionUser } from "@/server/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TryCommand, OpenAssistantButton } from "@/components/app/try-command";
import { formatDate } from "@/lib/domain";

export async function DoctorDashboard({ user }: { user: SessionUser }) {
  const d = user.doctorProfile!;
  const [patients, myNotes] = await Promise.all([
    listCarePatients(user.id),
    prisma.healthRecord.findMany({ where: { authorUserId: user.id }, orderBy: { recordDate: "desc" }, take: 6, include: { patient: { select: { id: true, fullName: true } } } }),
  ]);
  const flagged = await prisma.labResult.findMany({
    where: { record: { patientId: { in: patients.map((p) => p.patientId) } } },
    select: { value: true, refLow: true, refHigh: true, record: { select: { id: true, title: true, recordDate: true, patientId: true } } },
  });
  const flaggedReports = new Map<string, { id: string; title: string; date: Date; patientId: string }>();
  for (const f of flagged) {
    if (f.value == null) continue;
    if ((f.refLow != null && f.value < f.refLow) || (f.refHigh != null && f.value > f.refHigh))
      flaggedReports.set(f.record.id, { id: f.record.id, title: f.record.title, date: f.record.recordDate, patientId: f.record.patientId });
  }
  const nameOf = (pid: string) => patients.find((p) => p.patientId === pid)?.fullName ?? "Patient";
  const recentFlags = [...flaggedReports.values()].sort((a, b) => +b.date - +a.date).slice(0, 5);

  return (
    <div>
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-ink p-6 text-white md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-brand-400/30 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-sm font-semibold text-brand-200">Doctor workspace</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">Welcome, {d.fullName}</h1>
            <p className="mt-2 text-slate-300">{d.specialization} · {d.facilityName} · {d.city}</p>
            <div className="mt-3">
              {d.verificationStatus === "VERIFIED" ? (
                <Badge className="bg-white/10 text-white"><BadgeCheck aria-hidden />Registration {d.registrationNumber} verified</Badge>
              ) : (
                <Badge tone="warn"><Clock aria-hidden />Registration {d.registrationNumber} · verification pending</Badge>
              )}
            </div>
          </div>
          <OpenAssistantButton className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 pr-5 text-left ring-1 ring-white/20 hover:bg-white/15 cursor-pointer">
            <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-300 to-brand-600"><Mic className="size-7" aria-hidden /></span>
            <span><span className="block font-bold">Ask by voice</span><span className="block text-sm text-brand-200">తెలుగు · हिन्दी · English</span></span>
          </OpenAssistantButton>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Patients sharing with you", value: patients.length, icon: Users, href: "/patients" },
          { label: "Reports with flagged values", value: flaggedReports.size, icon: FileHeart, href: "/patients" },
          { label: "Notes & prescriptions written", value: myNotes.length, icon: ClipboardList, href: "/patients" },
        ].map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href} className="rounded-2xl border border-line bg-white p-5 shadow-soft hover:border-brand-300">
            <div className="flex items-start justify-between"><p className="text-sm font-semibold text-muted">{label}</p><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-5" aria-hidden /></span></div>
            <p className="mt-1 text-2xl font-extrabold">{value}</p>
          </Link>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="self-start xl:col-span-2">
          <CardHeader><CardTitle>My patients</CardTitle><Link href="/patients" className="text-sm font-semibold text-brand-700 hover:underline">View all</Link></CardHeader>
          <CardContent className="space-y-2">
            {patients.length === 0 && <p className="text-sm text-muted">No patients have shared their records with you yet. Patients can share from their Privacy & Sharing page.</p>}
            {patients.slice(0, 6).map((p) => (
              <Link key={p.patientId} href={`/patients/${p.patientId}`} className="flex items-center gap-4 rounded-xl border border-line px-4 py-3 hover:border-brand-300 hover:bg-brand-50/40">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-100 font-bold text-brand-800">{p.fullName[0]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.fullName}</span>
                  <span className="block truncate text-sm text-muted">{p.gender} · {new Date().getFullYear() - p.yearOfBirth} y · {p.city ?? "—"} · {p.recordCount} records</span>
                </span>
                {p.lastRecord && <span className="hidden text-right text-xs text-muted sm:block">Last: {p.lastRecord.title}<br />{formatDate(p.lastRecord.date)}</span>}
              </Link>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Needs review</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {recentFlags.length === 0 && <p className="text-sm text-muted">No flagged lab values.</p>}
              {recentFlags.map((r) => (
                <Link key={r.id} href={`/patients/${r.patientId}/records/${r.id}`} className="block rounded-xl border border-amber-200 bg-amber-50 p-3 hover:border-amber-300">
                  <p className="font-semibold">{nameOf(r.patientId)}</p>
                  <p className="text-sm text-ink-soft">{r.title} · {formatDate(r.date)}</p>
                </Link>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Try a voice command</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <TryCommand cmd="Open my patients" />
              <TryCommand cmd="मेरे मरीज़ दिखाओ" />
              <TryCommand cmd="నా రోగులను చూపించు" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
