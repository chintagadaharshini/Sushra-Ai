"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Info, Loader2, Lock, UserRound } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label, Select, Switch } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { TryCommand } from "@/components/app/try-command";
import { applyDisplayPrefs } from "@/components/app/app-shell";
import { formRegistry } from "@/lib/voice/form-bridge";
import { useAssistant } from "@/lib/voice/store";
import { displayValue } from "@/lib/voice/executor";
import { CITIES, LANGS, LANG_META, type Lang, type TextScale } from "@/lib/domain";
import { cn } from "@/lib/utils";

interface Prefs { preferredLanguage: Lang; city: string; textScale: TextScale; voiceResponses: boolean; highContrast: boolean }
interface Me {
  user: { email: string; phone: string | null; displayName: string; role: "PATIENT" | "DOCTOR" | "ASHA" };
  profile: { fullName: string; gender: string; yearOfBirth: number; bloodGroup: string | null; healthId: string; phoneMasked: string; state: string; city: string | null } | null;
  doctorProfile: { fullName: string; registrationNumber: string; specialization: string; facilityName: string; city: string; verificationStatus: string } | null;
  ashaProfile: { fullName: string; ashaId: string; village: string; district: string; phcName: string } | null;
  preferences: Prefs;
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (<><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></>);
}

function ProfileDetails({ me }: { me: Me }) {
  if (me.profile) {
    const p = me.profile;
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[0.95rem]">
        <Row k="Name" v={<b>{p.fullName}</b>} />
        <Row k="Health ID" v={<code className="rounded bg-cream px-1.5 py-0.5 text-sm">{p.healthId}</code>} />
        <Row k="Gender" v={p.gender} />
        <Row k="Year of birth" v={p.yearOfBirth} />
        <Row k="Blood group" v={p.bloodGroup ?? "—"} />
        <Row k="City" v={`${p.city ?? "—"}, ${p.state}`} />
        <Row k="Mobile" v={p.phoneMasked} />
      </dl>
    );
  }
  if (me.doctorProfile) {
    const d = me.doctorProfile;
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[0.95rem]">
        <Row k="Name" v={<b>{d.fullName}</b>} />
        <Row k="Registration" v={<>{d.registrationNumber} <Badge tone={d.verificationStatus === "VERIFIED" ? "brand" : "warn"} className="ml-1">{d.verificationStatus === "VERIFIED" ? "Verified" : "Verification pending"}</Badge></>} />
        <Row k="Specialization" v={d.specialization} />
        <Row k="Hospital / clinic" v={d.facilityName} />
        <Row k="City" v={d.city} />
        <Row k="Email" v={me.user.email} />
      </dl>
    );
  }
  const a = me.ashaProfile!;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[0.95rem]">
      <Row k="Name" v={<b>{a.fullName}</b>} />
      <Row k="ASHA ID" v={a.ashaId} />
      <Row k="Village / ward" v={a.village} />
      <Row k="District" v={a.district} />
      <Row k="PHC" v={a.phcName} />
      <Row k="Mobile" v={me.user.phone ?? "—"} />
    </dl>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [form, setForm] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const highlighted = useAssistant((s) => s.highlightedField);
  const { setHighlightedField, setLang, setVoiceOn } = useAssistant();
  const formRef = useRef<Prefs | null>(null);
  formRef.current = form;

  useEffect(() => {
    fetch("/api/me").then(async (r) => {
      if (r.status === 401) return router.push("/login");
      const d = (await r.json()) as Me;
      setMe(d);
      setForm(d.preferences);
    });
  }, [router]);

  const afterSave = (p: Prefs) => {
    applyDisplayPrefs(p);
    setVoiceOn(p.voiceResponses);
    router.refresh();
  };

  /** PATCH only the changed fields; returns server-confirmed preferences. */
  const persist = async (patch: Partial<Prefs>, channel: "UI" | "VOICE"): Promise<Prefs> => {
    const res = await fetch("/api/preferences", { method: "PATCH", headers: { "content-type": "application/json", "x-sv-channel": channel }, body: JSON.stringify(patch) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Save failed");
    const { preferences } = (await res.json()) as { preferences: Prefs };
    setMe((m) => (m ? { ...m, preferences } : m));
    setForm(preferences);
    afterSave(preferences);
    return preferences;
  };

  // Voice bridge — only whitelisted, non-sensitive preference fields.
  useEffect(() => {
    if (!form) return;
    return formRegistry.register({
      id: "preferences",
      fields: ["city", "preferredLanguage", "textScale", "voiceResponses"],
      getDisplay: (f) => {
        const v = formRef.current?.[f as keyof Prefs];
        return v === undefined ? undefined : displayValue(f, v as string | boolean, useAssistant.getState().lang);
      },
      setField: (f, v) => {
        setForm((p) => (p ? { ...p, [f]: v } : p));
        setHighlightedField(f);
        setTimeout(() => setHighlightedField(undefined), 2200);
      },
      save: async (f, v) => {
        const saved = await persist({ [f]: v } as Partial<Prefs>, "VOICE");
        if (f === "preferredLanguage") setLang(v as Lang);
        return saved[f as keyof Prefs] as string | boolean;
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(form)]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !me) return;
    const patch = Object.fromEntries(Object.entries(form).filter(([k, v]) => me.preferences[k as keyof Prefs] !== v)) as Partial<Prefs>;
    if (!Object.keys(patch).length) return setStatus({ ok: true, text: "Nothing to save — no changes." });
    setSaving(true);
    try {
      const saved = await persist(patch, "UI");
      if (patch.preferredLanguage) setLang(saved.preferredLanguage);
      setStatus({ ok: true, text: "Preferences saved." });
    } catch (err) {
      setStatus({ ok: false, text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const hl = (f: string) => cn(highlighted === f && "animate-flash rounded-xl");

  if (!me || !form) return <div className="h-96 animate-pulse rounded-2xl bg-white" />;
  return (
    <div>
      <PageHeader title="Profile & preferences" subtitle="Change preferences by hand or by voice — the assistant always asks before saving.">
        <TryCommand cmd="Set my city to Visakhapatnam" />
      </PageHeader>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><UserRound className="size-5" aria-hidden />My profile</CardTitle></CardHeader>
          <CardContent>
            <ProfileDetails me={me} />
            <p className="mt-4 flex gap-2 rounded-xl bg-cream p-3 text-sm text-ink-soft">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
              Sushra AI never stores Aadhaar numbers, OTPs or ABHA credentials, and the assistant refuses to handle them.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Preferences</CardTitle><Badge tone="brand">Voice-fillable</Badge></CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-5" aria-label="Preferences" data-testid="preferences-form">
              <div className={hl("preferredLanguage")}>
                <Label htmlFor="p-lang">Preferred language</Label>
                <div role="radiogroup" aria-labelledby="p-lang" className="grid grid-cols-3 gap-2">
                  {LANGS.map((l) => (
                    <button type="button" role="radio" aria-checked={form.preferredLanguage === l} key={l} onClick={() => setForm({ ...form, preferredLanguage: l })}
                      className={cn("h-14 rounded-xl border text-base font-bold cursor-pointer", form.preferredLanguage === l ? "border-ink bg-ink text-white" : "border-line bg-white hover:bg-cream")}>
                      {LANG_META[l].native}
                    </button>
                  ))}
                </div>
                <span id="p-lang" className="sr-only">Preferred language</span>
              </div>
              <div className={hl("city")}>
                <Label htmlFor="p-city">City</Label>
                <Select id="p-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} data-testid="pref-city">
                  {CITIES.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.te} · {c.hi}</option>)}
                </Select>
              </div>
              <div className={hl("textScale")}>
                <Label htmlFor="p-size">Text size</Label>
                <Select id="p-size" value={form.textScale} onChange={(e) => setForm({ ...form, textScale: e.target.value as TextScale })}>
                  <option value="normal">Normal</option><option value="large">Large</option><option value="xlarge">Extra large</option>
                </Select>
              </div>
              <div className={cn("flex items-center justify-between gap-4 rounded-xl border border-line p-3.5", hl("voiceResponses"))}>
                <div><p className="font-semibold">Spoken replies</p><p className="text-sm text-muted">The assistant reads its answers aloud.</p></div>
                <Switch checked={form.voiceResponses} onCheckedChange={(v) => setForm({ ...form, voiceResponses: v })} label="Spoken replies" />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-line p-3.5">
                <div><p className="font-semibold">High contrast</p><p className="text-sm text-muted">Stronger text and borders.</p></div>
                <Switch checked={form.highContrast} onCheckedChange={(v) => setForm({ ...form, highContrast: v })} label="High contrast" />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" variant="brand" size="lg" disabled={saving}>{saving && <Loader2 className="animate-spin" />}Save preferences</Button>
                {status && <p role="status" className={cn("flex items-center gap-1.5 text-sm font-semibold", status.ok ? "text-brand-700" : "text-bad")}>{status.ok && <CheckCircle2 className="size-4" />}{status.text}</p>}
              </div>
              <p className="flex gap-2 text-sm text-muted"><Info className="mt-0.5 size-4 shrink-0" aria-hidden />Saved city: <b>{me.preferences.city}</b> · language: <b>{LANG_META[me.preferences.preferredLanguage].label}</b></p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
