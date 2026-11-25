"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { CalendarPlus, CheckCircle2, Info, Loader2, X } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { TryCommand } from "@/components/app/try-command";
import { formRegistry } from "@/lib/voice/form-bridge";
import { useAssistant } from "@/lib/voice/store";
import { DEPARTMENTS, formatDate } from "@/lib/domain";
import type { FacilityDTO } from "@/server/abdm/types";
import { cn } from "@/lib/utils";

interface Appt {
  id: string; department: string; doctorName: string | null; scheduledAt: string | null; preferredDate: string | null; status: string; notes: string | null;
  facility: { id: string; name: string; city: string };
}

const STATUS: Record<string, { label: string; tone: "brand" | "warn" | "neutral" | "bad" }> = {
  SCHEDULED: { label: "Scheduled", tone: "brand" },
  REQUESTED: { label: "Requested · not yet confirmed", tone: "warn" },
  COMPLETED: { label: "Completed", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "bad" },
};

function RequestForm({ onCreated, initialFacility }: { onCreated: () => void; initialFacility?: string }) {
  const [facilities, setFacilities] = useState<FacilityDTO[]>([]);
  const [facilityId, setFacilityId] = useState(initialFacility ?? "");
  const [department, setDepartment] = useState<string>("General Medicine");
  const [preferredDate, setPreferredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const highlighted = useAssistant((s) => s.highlightedField);
  const setHighlight = useAssistant((s) => s.setHighlightedField);
  const state = useRef({ department, preferredDate });
  state.current = { department, preferredDate };

  useEffect(() => {
    fetch("/api/facilities").then((r) => r.json()).then((d) => setFacilities(d.facilities ?? []));
  }, []);

  // Voice bridge: the assistant may fill department/date after confirmation, but cannot submit.
  useEffect(
    () =>
      formRegistry.register({
        id: "appointment-request",
        fields: ["department", "preferredDate"],
        getDisplay: (f) => (f === "department" ? state.current.department : state.current.preferredDate ? formatDate(state.current.preferredDate) : undefined),
        setField: (f, v) => {
          if (f === "department") setDepartment(String(v));
          if (f === "preferredDate") setPreferredDate(String(v));
          setHighlight(f);
          setTimeout(() => setHighlight(undefined), 2200);
        },
      }),
    [setHighlight],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/appointments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ facilityId, department, preferredDate, ...(notes ? { notes } : {}) }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: data.error ?? "Could not save the request." });
    setMsg({ ok: true, text: "Request saved. It shows as “not yet confirmed” until the facility confirms a time." });
    onCreated();
  };

  return (
    <Card className="mb-6 border-brand-200">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2"><CalendarPlus className="size-5 text-brand-600" aria-hidden />Request an appointment</CardTitle>
          <p className="text-sm text-muted">Voice can fill department and date (say “set department to cardiology”). Only you can press Submit.</p>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2" aria-label="Appointment request" data-testid="appointment-form">
          <div>
            <Label htmlFor="a-fac">Facility</Label>
            <Select id="a-fac" required value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
              <option value="">Choose a facility…</option>
              {facilities.map((f) => <option key={f.id} value={f.id}>{f.name} — {f.city}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="a-dept">Department</Label>
            <Select id="a-dept" value={department} onChange={(e) => setDepartment(e.target.value)} className={cn(highlighted === "department" && "animate-flash")} data-testid="appt-department">
              {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="a-date">Preferred date</Label>
            <Input id="a-date" type="date" required value={preferredDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setPreferredDate(e.target.value)} className={cn(highlighted === "preferredDate" && "animate-flash")} />
          </div>
          <div>
            <Label htmlFor="a-notes">Notes (optional, no personal IDs)</Label>
            <Input id="a-notes" maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. follow-up visit" />
          </div>
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <Button type="submit" variant="brand" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Submit request</Button>
            <span className="flex items-center gap-1.5 text-sm text-muted"><Info className="size-4" aria-hidden />This is a request, not a confirmed booking.</span>
          </div>
          {msg && <p role="status" className={cn("md:col-span-2 flex gap-2 rounded-xl p-3 text-sm", msg.ok ? "bg-brand-50 text-brand-800" : "bg-red-50 text-bad")}>{msg.ok && <CheckCircle2 className="size-4" />}{msg.text}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

function AppointmentsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [appts, setAppts] = useState<Appt[] | null>(null);
  const showForm = params.get("new") === "1";
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/appointments").then((r) => r.json()).then((d) => setAppts(d.appointments));
  }, []);
  useEffect(load, [load]);

  const cancel = async (id: string) => {
    await fetch(`/api/appointments/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "cancel" }) });
    setConfirmCancel(null);
    load();
  };

  const now = Date.now();
  const upcoming = appts?.filter((a) => (a.status === "SCHEDULED" && a.scheduledAt && +new Date(a.scheduledAt) > now) || a.status === "REQUESTED") ?? [];
  const past = appts?.filter((a) => !upcoming.includes(a)) ?? [];

  const row = (a: Appt) => (
    <li key={a.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-white p-4 shadow-soft" data-testid="appointment-row">
      <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-ink text-center text-white">
        {a.scheduledAt ? (
          <span><span className="block text-xl font-extrabold leading-none">{new Date(a.scheduledAt).getDate()}</span><span className="text-xs uppercase">{new Date(a.scheduledAt).toLocaleString("en-IN", { month: "short" })}</span></span>
        ) : <CalendarPlus className="size-6" aria-hidden />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><p className="font-bold">{a.department}</p><Badge tone={STATUS[a.status]?.tone ?? "neutral"}>{STATUS[a.status]?.label ?? a.status}</Badge></div>
        <p className="text-sm text-muted">{a.doctorName ?? "Doctor not assigned"} · {a.facility.name}, {a.facility.city}</p>
        <p className="text-sm font-semibold text-ink-soft">
          {a.scheduledAt ? new Date(a.scheduledAt).toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" }) : `Preferred date: ${formatDate(a.preferredDate!)}`}
        </p>
      </div>
      {(a.status === "SCHEDULED" || a.status === "REQUESTED") && (
        confirmCancel === a.id ? (
          <div className="flex items-center gap-2" role="group" aria-label="Confirm cancellation">
            <span className="text-sm font-semibold">Cancel this?</span>
            <Button size="sm" variant="danger" onClick={() => cancel(a.id)}>Yes, cancel</Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmCancel(null)}>Keep</Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setConfirmCancel(a.id)}><X />Cancel</Button>
        )
      )}
    </li>
  );

  return (
    <div>
      <PageHeader title="Appointments" subtitle="Your appointments and requests.">
        <TryCommand cmd="Open appointment booking" />
        {!showForm && <Button variant="brand" onClick={() => router.push("/appointments?new=1")}><CalendarPlus />New request</Button>}
      </PageHeader>
      {showForm && <RequestForm onCreated={load} initialFacility={params.get("facility") ?? undefined} />}
      <h2 className="mb-3 text-lg font-bold">Upcoming</h2>
      {!appts ? <div className="h-24 animate-pulse rounded-2xl bg-white" /> : upcoming.length ? <ul className="mb-8 space-y-2.5">{upcoming.map(row)}</ul> : <p className="mb-8 text-muted">Nothing upcoming.</p>}
      <h2 className="mb-3 text-lg font-bold">Past & cancelled</h2>
      <ul className="space-y-2.5">{past.map(row)}</ul>
    </div>
  );
}

export default function AppointmentsPage() {
  return <Suspense><AppointmentsInner /></Suspense>;
}
