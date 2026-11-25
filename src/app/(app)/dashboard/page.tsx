import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, CalendarDays, FileHeart, Mic, ShieldCheck, AlertCircle, CheckCircle2, Users } from "lucide-react";
import { getSessionUser, type SessionUser } from "@/server/session";
import { prisma } from "@/server/db";
import { getHealthDataProvider } from "@/server/abdm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TryCommand, OpenAssistantButton } from "@/components/app/try-command";
import { TrendChart } from "@/components/app/trend-chart";
import { RECORD_TYPE_LABEL, cityName, formatDate } from "@/lib/domain";
import { activityLabel } from "@/lib/activity";

export const metadata = { title: "Dashboard" };

import { DoctorDashboard } from "@/components/dashboards/doctor-dashboard";
import { AshaDashboard } from "@/components/dashboards/asha-dashboard";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "DOCTOR") return <DoctorDashboard user={user} />;
  if (user.role === "ASHA") return <AshaDashboard user={user} />;
  return <PatientDashboard user={user} />;
}

async function PatientDashboard({ user }: { user: SessionUser }) {
  const pid = user.profile!.id;
  const [records, appts, events, consents, hb] = await Promise.all([
    getHealthDataProvider().listRecords(pid),
    prisma.appointment.findMany({ where: { patientId: pid, status: { in: ["SCHEDULED", "REQUESTED"] } }, include: { facility: true }, orderBy: [{ scheduledAt: "asc" }, { preferredDate: "asc" }] }),
    prisma.auditEvent.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 7 }),
    prisma.consentRecord.findMany({ where: { patientId: pid, status: "GRANTED", purpose: "CARE_ACCESS", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: { createdAt: "desc" } }),
    prisma.labResult.findMany({ where: { testCode: "HGB", record: { patientId: pid } }, include: { record: { select: { recordDate: true } } } }),
  ]);
  const next = appts.find((a) => a.scheduledAt && a.scheduledAt > new Date());
  const flagged = records.filter((r) => r.abnormalCount > 0);
  const hbPoints = hb.map((h) => ({ date: h.record.recordDate.toISOString(), value: h.value! })).sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const hour = Number(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const stats = [
    { label: "Next appointment", value: next ? formatDate(next.scheduledAt!) : "None", sub: next ? next.department : "Book from Appointments", icon: CalendarDays, href: "/appointments" },
    { label: "Health records", value: String(records.length), sub: `${records.filter((r) => r.recordType === "LAB_REPORT").length} lab reports`, icon: FileHeart, href: "/records" },
    { label: "Reports with flagged values", value: String(flagged.length), sub: "Outside the lab's range", icon: AlertCircle, href: "/records?flagged=1" },
    { label: "Care team", value: String(consents.length), sub: consents.length ? "can view your records" : "Share with your doctor", icon: Users, href: "/privacy" },
  ];

  return (
    <div>
      {/* Welcome */}
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-ink p-6 text-white md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-brand-400/30 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-sm font-semibold text-brand-200">{greet}</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">Namaste, {user.displayName} 🙏</h1>
            <p className="mt-2 max-w-xl text-[0.95rem] text-slate-300">
              {user.profile!.fullName} · {user.profile!.gender}, born {user.profile!.yearOfBirth} · {cityName(user.preferences?.city ?? "", "en")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge className="bg-white/10 text-white">Health ID: {user.profile!.healthId}</Badge>
            </div>
          </div>
          <OpenAssistantButton className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 pr-5 text-left ring-1 ring-white/20 hover:bg-white/15 cursor-pointer">
            <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-300 to-brand-600"><Mic className="size-7" aria-hidden /></span>
            <span>
              <span className="block font-bold">Speak to manage your health</span>
              <span className="block text-sm text-brand-200">తెలుగు · हिन्दी · English</span>
            </span>
          </OpenAssistantButton>
        </div>
      </section>

      {/* Stats */}
      <section aria-label="Overview" className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, sub, icon: Icon, href }) => (
          <Link key={label} href={href} className="group rounded-2xl border border-line bg-white p-5 shadow-soft transition hover:border-brand-300">
            <div className="flex items-start justify-between">
              <p className="text-sm font-semibold text-muted">{label}</p>
              <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-5" aria-hidden /></span>
            </div>
            <p className="mt-1 text-2xl font-extrabold">{value}</p>
            <p className="text-sm text-muted">{sub}</p>
          </Link>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {/* Recent reports */}
          <Card>
            <CardHeader>
              <CardTitle>Recent medical reports</CardTitle>
              <Link href="/records" className="text-sm font-semibold text-brand-700 hover:underline">View all</Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {records.slice(0, 5).map((r) => (
                <Link key={r.id} href={`/records/${r.id}`} className="flex items-center gap-4 rounded-xl border border-line px-4 py-3 hover:border-brand-300 hover:bg-brand-50/40">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-cream text-ink"><FileHeart className="size-5" aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.title}</span>
                    <span className="block truncate text-sm text-muted">{formatDate(r.recordDate)} · {r.facilityName}</span>
                  </span>
                  <span className="hidden sm:block"><Badge>{RECORD_TYPE_LABEL[r.recordType]}</Badge></span>
                  {r.abnormalCount > 0 ? (
                    <Badge tone="warn"><AlertCircle aria-hidden />{r.abnormalCount} outside range</Badge>
                  ) : r.recordType === "LAB_REPORT" ? (
                    <Badge tone="brand"><CheckCircle2 aria-hidden />Within range</Badge>
                  ) : null}
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* Trend */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Haemoglobin over time</CardTitle>
                <p className="text-sm text-muted">From your CBC reports · g/dL · shaded band is the lab&apos;s reference range</p>
              </div>
            </CardHeader>
            <CardContent>
              <TrendChart points={hbPoints} refLow={12} refHigh={15.5} unit="g/dL" label="Haemoglobin" />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming appointments</CardTitle>
              <Link href="/appointments" className="text-sm font-semibold text-brand-700 hover:underline">View all</Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {appts.length === 0 && <p className="text-sm text-muted">No upcoming appointments.</p>}
              {appts.slice(0, 3).map((a) => (
                <div key={a.id} className="rounded-xl border border-line p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{a.department}</p>
                    <Badge tone={a.status === "SCHEDULED" ? "brand" : "warn"}>{a.status === "SCHEDULED" ? "Scheduled" : "Requested"}</Badge>
                  </div>
                  <p className="text-sm text-muted">{a.doctorName ?? "Doctor to be assigned"} · {a.facility.name}</p>
                  <p className="mt-1 text-sm font-semibold text-ink-soft">
                    {a.scheduledAt ? a.scheduledAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : `Preferred: ${formatDate(a.preferredDate!)}`}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>My care team</CardTitle><Link href="/privacy" className="text-sm font-semibold text-brand-700 hover:underline">Manage</Link></CardHeader>
            <CardContent className="space-y-2">
              {consents.length === 0 && <p className="text-sm text-muted">No one can see your records yet. Share them with your doctor or ASHA worker from Privacy & Sharing.</p>}
              {consents.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-line p-3">
                  <span className="min-w-0"><span className="block truncate font-semibold">{c.grantedTo}</span><span className="block text-xs text-muted">Until {c.expiresAt ? formatDate(c.expiresAt) : "you revoke"}</span></span>
                  <ShieldCheck className="size-5 shrink-0 text-brand-600" aria-hidden />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Try a voice command</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <TryCommand cmd="నా హెల్త్ రికార్డ్స్ చూపించు" />
              <TryCommand cmd="Show me my latest blood test report" />
              <TryCommand cmd="मेरी मेडिकल रिपोर्ट समझाओ" />
              <TryCommand cmd="Find hospitals near Visakhapatnam" />
              <TryCommand cmd="Change my preferred city to Hyderabad" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Recent activity</CardTitle><Activity className="size-5 text-muted" aria-hidden /></CardHeader>
            <CardContent>
              <ol className="relative space-y-3 border-l-2 border-line pl-4">
                {events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full bg-brand-500 ring-4 ring-white" aria-hidden />
                    <p className="text-sm font-semibold">
                      {activityLabel(e.action)} {e.channel === "VOICE" && <Badge tone="brand" className="ml-1"><Mic aria-hidden />voice</Badge>}
                    </p>
                    <p className="text-xs text-muted">{e.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
