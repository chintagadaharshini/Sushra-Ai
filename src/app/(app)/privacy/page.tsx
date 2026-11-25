"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, ExternalLink, HeartHandshake, Mic, Search, ServerCog, ShieldCheck, ShieldOff, Sparkles, Stethoscope, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { useAssistant } from "@/lib/voice/store";
import { formatDate } from "@/lib/domain";
import { cn } from "@/lib/utils";

interface Consent { id: string; purpose: string; scope: string; grantedTo: string; grantedToUserId: string | null; status: string; createdAt: string; expiresAt: string | null }
interface Person { userId: string; role: "DOCTOR" | "ASHA"; name: string; detail: string; city: string; verified: boolean }
interface Status { abdmCredentialsPresent: boolean; liveAbdmConnected: boolean; note: string; llmConfigured: boolean }

const PURPOSE: Record<string, string> = { CARE_ACCESS: "Care team access", SHARE_WITH_FACILITY: "Shared with a facility", AI_REPORT_EXPLANATION: "AI wording for report explanations" };

function VoiceAndData() {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Mic className="size-5" aria-hidden />Voice & data handling</CardTitle></CardHeader>
      <CardContent>
        <ul className="space-y-2.5 text-[0.95rem]">
          {[
            "The microphone turns on only when you press the mic button, and a green indicator shows while it listens.",
            "Raw audio is not stored. Speech is converted to text by the browser's speech service or, in Studio voice, by Sarvam AI.",
            "Conversations stay in this browser tab and are cleared when you close the assistant or reload.",
            "The activity log stores which action happened (for example, ‘opened a record by voice’), never what you said.",
            "Every change asks for your confirmation first. Consents, registrations and clinical notes can only be submitted on screen.",
            "The assistant refuses passwords, OTPs, Aadhaar numbers and ABHA credentials.",
            "Report explanations are for understanding only. They are not a diagnosis or treatment advice.",
          ].map((t) => (
            <li key={t} className="flex gap-2"><ShieldCheck className="mt-0.5 size-4.5 shrink-0 text-brand-600" aria-hidden />{t}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function IntegrationCard({ status }: { status: Status | null }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ServerCog className="size-5" aria-hidden />ABDM / ABHA</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[0.95rem]">
        <div className="flex flex-wrap gap-2">
          <Badge tone={status?.liveAbdmConnected ? "brand" : "neutral"}>ABDM: {status?.liveAbdmConnected ? "connected" : "not linked yet"}</Badge>
          <Badge tone={status?.llmConfigured ? "brand" : "neutral"}>AI wording: {status?.llmConfigured ? "available" : "off"}</Badge>
        </div>
        <p className="text-ink-soft">{status?.note}</p>
        <p className="text-ink-soft">Sushra AI is an independent app. It is not an official government service. To create or manage your ABHA, use the official ABDM channels:</p>
        <div className="flex flex-col gap-1.5 text-sm font-semibold">
          <a className="inline-flex items-center gap-1 text-brand-700 hover:underline" href="https://abha.abdm.gov.in" target="_blank" rel="noreferrer">abha.abdm.gov.in <ExternalLink className="size-3.5" /></a>
          <a className="inline-flex items-center gap-1 text-brand-700 hover:underline" href="https://abdm.gov.in" target="_blank" rel="noreferrer">abdm.gov.in <ExternalLink className="size-3.5" /></a>
        </div>
      </CardContent>
    </Card>
  );
}

function CareTeamSharing({ consents, reload }: { consents: Consent[]; reload: () => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"DOCTOR" | "ASHA">("DOCTOR");
  const [pick, setPick] = useState<string>("");
  const [days, setDays] = useState("90");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    fetch("/api/care/directory").then((r) => r.json()).then((d) => setPeople(d.people ?? []));
  }, []);
  const active = consents.filter((c) => c.purpose === "CARE_ACCESS" && c.status === "GRANTED" && (!c.expiresAt || +new Date(c.expiresAt) > Date.now()));
  const filtered = useMemo(
    () => people.filter((p) => p.role === kind && !active.some((a) => a.grantedToUserId === p.userId) && `${p.name} ${p.detail} ${p.city}`.toLowerCase().includes(q.toLowerCase())),
    [people, kind, q, active],
  );
  const share = async () => {
    setMsg(null);
    const res = await fetch("/api/consents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "share", granteeUserId: pick, days: Number(days) }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg({ ok: false, text: d.error ?? "Could not share" });
    setMsg({ ok: true, text: "Shared. They can now see your records." });
    setPick("");
    reload();
  };
  const revoke = async (id: string) => {
    await fetch("/api/consents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "revoke", id }) });
    reload();
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2"><HeartHandshake className="size-5 text-brand-600" aria-hidden />My care team</CardTitle>
          <p className="text-sm text-muted">Only people you choose can see your records. You can stop sharing at any time.</p>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-bold text-ink-soft">Currently sharing with</p>
          {active.length === 0 && <p className="rounded-xl bg-canvas p-4 text-sm text-muted">No one yet.</p>}
          <ul className="space-y-2" data-testid="care-team">
            {active.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{c.grantedTo}</p>
                  <p className="text-sm text-muted">{c.scope} · until {c.expiresAt ? formatDate(c.expiresAt) : "you revoke"}</p>
                </div>
                <Button size="sm" variant="danger" onClick={() => revoke(c.id)}><ShieldOff />Stop sharing</Button>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-line bg-canvas p-4">
          <p className="mb-3 text-sm font-bold text-ink-soft">Share with a doctor or ASHA worker</p>
          <div role="tablist" className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-white p-1 text-sm font-bold">
            {(["DOCTOR", "ASHA"] as const).map((k) => (
              <button key={k} role="tab" aria-selected={kind === k} onClick={() => { setKind(k); setPick(""); }} className={cn("flex h-9 items-center justify-center gap-1.5 rounded-lg cursor-pointer", kind === k ? "bg-ink text-white" : "text-muted")}>
                {k === "DOCTOR" ? <Stethoscope className="size-4" /> : <HeartHandshake className="size-4" />}{k === "DOCTOR" ? "Doctor" : "ASHA worker"}
              </button>
            ))}
          </div>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, hospital, village or city" className="pl-9" aria-label="Search care providers" />
          </div>
          <ul className="max-h-56 space-y-1.5 overflow-y-auto" role="listbox" aria-label="Care providers">
            {filtered.length === 0 && <li className="p-3 text-sm text-muted">No matches.</li>}
            {filtered.map((p) => (
              <li key={p.userId}>
                <button role="option" aria-selected={pick === p.userId} onClick={() => setPick(p.userId)} className={cn("w-full rounded-xl border p-3 text-left cursor-pointer", pick === p.userId ? "border-brand-500 bg-brand-50" : "border-line bg-white hover:border-brand-300")}>
                  <span className="flex items-center gap-1.5 font-semibold">{p.name}{p.role === "DOCTOR" && p.verified && <BadgeCheck className="size-4 text-brand-600" aria-label="Verified" />}</span>
                  <span className="block text-sm text-muted">{p.detail} · {p.city}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="flex-1"><Label htmlFor="days">For how long</Label><Select id="days" value={days} onChange={(e) => setDays(e.target.value)}><option value="30">1 month</option><option value="90">3 months</option><option value="180">6 months</option><option value="365">1 year</option></Select></div>
            <Button variant="brand" disabled={!pick} onClick={share}><UserPlus />Share records</Button>
          </div>
          {msg && <p role="status" className={cn("mt-2 text-sm font-semibold", msg.ok ? "text-brand-700" : "text-bad")}>{msg.text}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PrivacyPage() {
  const role = useAssistant((s) => s.role);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const load = useCallback(() => {
    if (useAssistant.getState().role === "PATIENT") fetch("/api/consents").then((r) => (r.ok ? r.json() : { consents: [] })).then((d) => setConsents(d.consents ?? []));
    fetch("/api/integration/status").then((r) => r.json()).then(setStatus);
  }, []);
  useEffect(load, [load, role]);

  const act = async (body: object) => {
    await fetch("/api/consents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    load();
  };
  const aiGranted = consents.some((c) => c.purpose === "AI_REPORT_EXPLANATION" && c.status === "GRANTED");
  const other = consents.filter((c) => c.purpose !== "CARE_ACCESS");

  return (
    <div>
      <PageHeader title={role === "PATIENT" ? "Privacy & sharing" : "Privacy"} subtitle={role === "PATIENT" ? "Decide who can see your health records, and how your data is handled." : "How patient data and voice are handled in your workspace."} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {role === "PATIENT" && <CareTeamSharing consents={consents} reload={load} />}
        {role !== "PATIENT" && (
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Your responsibilities</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2 text-[0.95rem]">
                <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4.5 shrink-0 text-brand-600" />You can see a patient&apos;s records only while they share them with you. Access ends automatically when it expires or the patient stops sharing.</li>
                <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4.5 shrink-0 text-brand-600" />Every record you open and every note you add is logged.</li>
                <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4.5 shrink-0 text-brand-600" />Never record Aadhaar, OTPs or other ID numbers in notes.</li>
              </ul>
            </CardContent>
          </Card>
        )}
        <VoiceAndData />
        <IntegrationCard status={status} />
        {role === "PATIENT" && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Other consents</CardTitle>
              {!aiGranted && status?.llmConfigured && (
                <Button variant="soft" size="sm" onClick={() => act({ action: "grant", purpose: "AI_REPORT_EXPLANATION" })}><Sparkles />Allow AI wording for explanations</Button>
              )}
            </CardHeader>
            <CardContent>
              {other.length === 0 && <p className="text-sm text-muted">None.</p>}
              <ul className="space-y-2.5">
                {other.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{PURPOSE[c.purpose] ?? c.purpose} <Badge tone={c.status === "GRANTED" ? "brand" : "neutral"} className="ml-1">{c.status === "GRANTED" ? "Active" : "Revoked"}</Badge></p>
                      <p className="text-sm text-muted">{c.scope} · {c.grantedTo} · since {formatDate(c.createdAt)}{c.expiresAt ? ` · until ${formatDate(c.expiresAt)}` : ""}</p>
                    </div>
                    {c.status === "GRANTED" && <Button size="sm" variant="danger" onClick={() => act({ action: "revoke", id: c.id })}><ShieldOff />Revoke</Button>}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
