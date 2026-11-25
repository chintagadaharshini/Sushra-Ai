"use client";
import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Copy, Loader2, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { useAssistant } from "@/lib/voice/store";
import { CITIES, LANGS, LANG_META } from "@/lib/domain";

interface Done { patientId: string; healthId: string; loginPhone: string; temporaryPassword: string }

export default function RegisterPatientPage() {
  const role = useAssistant((s) => s.role);
  const [f, setF] = useState({ fullName: "", phone: "", gender: "Female", yearOfBirth: "", city: "Vijayawada", preferredLanguage: "te" });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  if (role !== "ASHA") return <p className="text-muted">Only ASHA workers can register patients.</p>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/care/register-patient", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, yearOfBirth: Number(f.yearOfBirth), consentConfirmed: consent }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.issues?.[0]?.message ?? data.error ?? "Could not register");
    setDone(data);
  };

  if (done)
    return (
      <div className="mx-auto max-w-xl">
        <Card><CardContent className="pt-6 text-center">
          <CheckCircle2 className="mx-auto size-12 text-brand-600" />
          <h1 className="mt-3 text-2xl font-extrabold">{f.fullName} is registered</h1>
          <p className="mt-1 text-muted">Health ID <b>{done.healthId}</b>. You can now record home visits for them.</p>
          <div className="mt-5 rounded-2xl bg-cream p-4 text-left">
            <p className="text-sm font-bold">Give these sign-in details to the patient (shown only once):</p>
            <p className="mt-2 text-lg">Mobile: <b>{done.loginPhone}</b></p>
            <p className="text-lg">Password: <b data-testid="temp-password">{done.temporaryPassword}</b> <button onClick={() => navigator.clipboard?.writeText(done.temporaryPassword)} aria-label="Copy password" className="ml-1 align-middle cursor-pointer"><Copy className="inline size-4" /></button></p>
            <p className="mt-2 text-xs text-muted">The patient can change who sees their records at any time from Privacy & Sharing.</p>
          </div>
          <div className="mt-5 flex justify-center gap-2">
            <Link href={`/patients/${done.patientId}`}><Button variant="brand">Open patient</Button></Link>
            <Button variant="outline" onClick={() => { setDone(null); setConsent(false); setF({ ...f, fullName: "", phone: "", yearOfBirth: "" }); }}>Register another</Button>
          </div>
        </CardContent></Card>
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Register a patient" subtitle="For people without a smartphone or email. They sign in later with their mobile number." />
      <Card><CardContent className="pt-6">
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="assisted-register">
          <div className="sm:col-span-2"><Label htmlFor="r-name">Full name</Label><Input id="r-name" required value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></div>
          <div><Label htmlFor="r-phone">Mobile number</Label><Input id="r-phone" required inputMode="numeric" maxLength={10} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, "") })} placeholder="10 digits" /></div>
          <div><Label htmlFor="r-yob">Year of birth</Label><Input id="r-yob" required inputMode="numeric" maxLength={4} value={f.yearOfBirth} onChange={(e) => setF({ ...f, yearOfBirth: e.target.value.replace(/\D/g, "") })} placeholder="e.g. 1968" /></div>
          <div><Label htmlFor="r-gender">Gender</Label><Select id="r-gender" value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}><option>Female</option><option>Male</option><option>Other</option></Select></div>
          <div><Label htmlFor="r-city">City / district</Label><Select id="r-city" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })}>{CITIES.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.te}</option>)}</Select></div>
          <div className="sm:col-span-2"><Label htmlFor="r-lang">Language the patient prefers</Label><Select id="r-lang" value={f.preferredLanguage} onChange={(e) => setF({ ...f, preferredLanguage: e.target.value })}>{LANGS.map((l) => <option key={l} value={l}>{LANG_META[l].native}</option>)}</Select></div>
          <label className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-line bg-cream p-3 text-sm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-5 accent-brand-600" required />
            <span>I explained to the patient that I (their ASHA worker) will be able to see their health records and add home-visit notes, and they agreed. They can stop this any time.</span>
          </label>
          <p className="sm:col-span-2 text-xs text-muted">Do not enter Aadhaar or any ID numbers.</p>
          {error && <p role="alert" className="sm:col-span-2 rounded-xl bg-red-50 p-3 text-sm text-bad">{error}</p>}
          <div className="sm:col-span-2"><Button type="submit" variant="brand" size="lg" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <UserPlus />}Register patient</Button></div>
        </form>
      </CardContent></Card>
    </div>
  );
}
