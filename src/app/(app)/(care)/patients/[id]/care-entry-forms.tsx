"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, ClipboardPlus, HeartPulse, Loader2, Pill, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type Med = { name: string; dose: string; frequency: string; duration: string };

async function post(patientId: string, body: unknown) {
  const res = await fetch(`/api/care/patients/${patientId}/records`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.issues?.[0]?.message ?? data.error ?? "Could not save");
  return data;
}

function Status({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return <p role="status" className={cn("flex items-center gap-2 rounded-xl p-3 text-sm", msg.ok ? "bg-brand-50 text-brand-800" : "bg-red-50 text-bad")}>{msg.ok && <CheckCircle2 className="size-4" />}{msg.text}</p>;
}

export function CareEntryForms({ patientId, role, patientName }: { patientId: string; role: "DOCTOR" | "ASHA"; patientName: string }) {
  return role === "DOCTOR" ? <DoctorForms patientId={patientId} patientName={patientName} /> : <AshaVisitForm patientId={patientId} patientName={patientName} />;
}

function DoctorForms({ patientId, patientName }: { patientId: string; patientName: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<"note" | "rx">("note");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [complaint, setComplaint] = useState("");
  const [notes, setNotes] = useState("");
  const [plan, setPlan] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [meds, setMeds] = useState<Med[]>([{ name: "", dose: "", frequency: "", duration: "" }]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (tab === "note") {
        await post(patientId, { kind: "CONSULTATION", chiefComplaint: complaint, ...(notes ? { notes } : {}), plan: plan.split("\n").map((s) => s.trim()).filter(Boolean), ...(followUp ? { followUp } : {}) });
        setComplaint(""); setNotes(""); setPlan(""); setFollowUp("");
      } else {
        await post(patientId, { kind: "PRESCRIPTION", medications: meds.filter((m) => m.name.trim()) });
        setMeds([{ name: "", dose: "", frequency: "", duration: "" }]);
      }
      setMsg({ ok: true, text: `Saved to ${patientName}'s records.` });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="sticky top-24">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ClipboardPlus className="size-5 text-brand-600" aria-hidden />Add to record</CardTitle>
      </CardHeader>
      <CardContent>
        <div role="tablist" className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-cream p-1 text-sm font-bold">
          <button role="tab" aria-selected={tab === "note"} onClick={() => setTab("note")} className={cn("h-9 rounded-lg cursor-pointer", tab === "note" ? "bg-white shadow-soft" : "text-muted")}>Consultation note</button>
          <button role="tab" aria-selected={tab === "rx"} onClick={() => setTab("rx")} className={cn("h-9 rounded-lg cursor-pointer", tab === "rx" ? "bg-white shadow-soft" : "text-muted")}>Prescription</button>
        </div>
        <form onSubmit={submit} className="space-y-3" data-testid="doctor-form">
          {tab === "note" ? (
            <>
              <div><Label htmlFor="c1">Reason for visit</Label><Input id="c1" required value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder="e.g. Follow-up for tiredness" /></div>
              <div><Label htmlFor="c2">Clinical notes</Label><textarea id="c2" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-xl border border-line p-3 text-[0.95rem] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" /></div>
              <div><Label htmlFor="c3">Plan (one item per line)</Label><textarea id="c3" value={plan} onChange={(e) => setPlan(e.target.value)} rows={3} className="w-full rounded-xl border border-line p-3 text-[0.95rem] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" /></div>
              <div><Label htmlFor="c4">Follow-up</Label><Input id="c4" value={followUp} onChange={(e) => setFollowUp(e.target.value)} placeholder="e.g. Review in 4 weeks" /></div>
            </>
          ) : (
            <div className="space-y-3">
              {meds.map((m, i) => (
                <div key={i} className="space-y-2 rounded-xl border border-line p-3">
                  <div className="flex items-center gap-2">
                    <Pill className="size-4 text-brand-600" aria-hidden />
                    <Input aria-label="Medicine" required={i === 0} placeholder="Medicine and strength" value={m.name} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    {meds.length > 1 && <button type="button" aria-label="Remove medicine" onClick={() => setMeds(meds.filter((_, j) => j !== i))} className="grid size-10 place-items-center rounded-lg hover:bg-cream cursor-pointer"><Trash2 className="size-4" /></button>}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input aria-label="Dose" placeholder="Dose" value={m.dose} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, dose: e.target.value } : x)))} />
                    <Input aria-label="When" placeholder="When" value={m.frequency} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, frequency: e.target.value } : x)))} />
                    <Input aria-label="Duration" placeholder="Duration" value={m.duration} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, duration: e.target.value } : x)))} />
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setMeds([...meds, { name: "", dose: "", frequency: "", duration: "" }])}><Plus />Add medicine</Button>
            </div>
          )}
          <Button type="submit" variant="brand" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Save {tab === "note" ? "note" : "prescription"}</Button>
          <Status msg={msg} />
        </form>
      </CardContent>
    </Card>
  );
}

function AshaVisitForm({ patientId, patientName }: { patientId: string; patientName: string }) {
  const router = useRouter();
  const [v, setV] = useState({ systolic: "", diastolic: "", weightKg: "", bloodSugar: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = { kind: "HOME_VISIT" };
      for (const [k, val] of Object.entries(v)) if (val.trim()) body[k] = k === "notes" ? val.trim() : Number(val);
      await post(patientId, body);
      setV({ systolic: "", diastolic: "", weightKg: "", bloodSugar: "", notes: "" });
      setMsg({ ok: true, text: `Home visit saved to ${patientName}'s records.` });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const field = (k: keyof typeof v, label: string, placeholder: string) => (
    <div><Label htmlFor={`v-${k}`}>{label}</Label><Input id={`v-${k}`} inputMode="numeric" value={v[k]} placeholder={placeholder} onChange={(e) => setV({ ...v, [k]: e.target.value.replace(/[^\d.]/g, "") })} /></div>
  );
  return (
    <Card className="sticky top-24">
      <CardHeader><CardTitle className="flex items-center gap-2"><HeartPulse className="size-5 text-brand-600" aria-hidden />Record a home visit</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3" data-testid="asha-form">
          <div className="grid grid-cols-2 gap-3">
            {field("systolic", "BP — upper", "e.g. 130")}
            {field("diastolic", "BP — lower", "e.g. 84")}
            {field("weightKg", "Weight (kg)", "e.g. 58")}
            {field("bloodSugar", "Sugar (mg/dL)", "glucometer")}
          </div>
          <div><Label htmlFor="v-notes">Notes</Label><textarea id="v-notes" rows={3} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} className="w-full rounded-xl border border-line p-3 text-[0.95rem] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100" placeholder="Advice given, symptoms reported, referrals…" /></div>
          <Button type="submit" variant="brand" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Save visit</Button>
          <p className="text-xs text-muted">Home readings are saved as “Recorded by ASHA worker” — they are not a diagnosis.</p>
          <Status msg={msg} />
        </form>
      </CardContent>
    </Card>
  );
}
