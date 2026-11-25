"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { RoleTabs } from "@/components/auth/role-tabs";
import { AuthAside } from "@/components/auth/auth-aside";
import { CITIES, DEPARTMENTS, LANGS, LANG_META, ROLES, ROLE_LABEL, registerSchema, type Role } from "@/lib/domain";

type Form = Record<string, string>;

function RegisterInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = (ROLES as readonly string[]).includes(params.get("role") ?? "") ? (params.get("role") as Role) : "PATIENT";
  const [role, setRole] = useState<Role>(initial);
  const [f, setF] = useState<Form>({ preferredLanguage: "te", gender: "Female", city: "Vijayawada", district: "Vijayawada", specialization: "General Medicine" });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (f.password !== f.confirm) return setErrors({ confirm: "Passwords do not match" });
    const fields: Record<Role, string[]> = {
      PATIENT: ["gender", "yearOfBirth", "city"],
      DOCTOR: ["registrationNumber", "specialization", "facilityName", "city"],
      ASHA: ["ashaId", "village", "district", "phcName"],
    };
    const payload: Record<string, unknown> = { role, fullName: f.fullName, email: f.email, phone: f.phone, password: f.password, preferredLanguage: f.preferredLanguage };
    for (const k of fields[role]) payload[k] = f[k];
    const parsed = registerSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    const res = await fetch("/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data) });
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Registration failed");
      setBusy(false);
    }
  };

  const field = (k: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <Label htmlFor={`f-${k}`}>{label}</Label>
      <Input id={`f-${k}`} value={f[k] ?? ""} onChange={set(k)} aria-invalid={Boolean(errors[k])} {...props} />
      {errors[k] && <p className="mt-1 text-xs font-semibold text-bad">{errors[k]}</p>}
    </div>
  );
  const citySelect = (k: string, label: string) => (
    <div><Label htmlFor={`f-${k}`}>{label}</Label><Select id={`f-${k}`} value={f[k]} onChange={set(k)}>{CITIES.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.te} · {c.hi}</option>)}</Select></div>
  );

  return (
    <div className="min-h-dvh">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-2 lg:py-14">
        <div>
          <Link href="/"><Logo /></Link>
          <h1 className="mt-8 text-4xl font-extrabold tracking-tight">Create your account</h1>
          <p className="mt-2 text-muted">Already registered? <Link href="/login" className="font-bold text-brand-700 hover:underline">Sign in</Link></p>
          <form onSubmit={submit} noValidate className="mt-6 space-y-4 rounded-2xl border border-line bg-white p-5 shadow-soft" aria-label="Register">
            <RoleTabs value={role} onChange={(r) => { setRole(r); setErrors({}); }} />
            {field("fullName", role === "DOCTOR" ? "Full name (as registered)" : "Full name", { autoComplete: "name" })}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {field("email", "Email", { type: "email", autoComplete: "email" })}
              {field("phone", "Mobile number", { inputMode: "numeric", maxLength: 10, placeholder: "10 digits", autoComplete: "tel" })}
            </div>

            {role === "PATIENT" && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div><Label htmlFor="f-gender">Gender</Label><Select id="f-gender" value={f.gender} onChange={set("gender")}><option>Female</option><option>Male</option><option>Other</option></Select></div>
                {field("yearOfBirth", "Year of birth", { inputMode: "numeric", maxLength: 4, placeholder: "e.g. 1965" })}
                {citySelect("city", "City")}
              </div>
            )}
            {role === "DOCTOR" && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {field("registrationNumber", "Medical council registration no.", { placeholder: "e.g. APMC/2010/12345" })}
                <div><Label htmlFor="f-spec">Specialization</Label><Select id="f-spec" value={f.specialization} onChange={set("specialization")}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</Select></div>
                {field("facilityName", "Hospital / clinic")}
                {citySelect("city", "City")}
              </div>
            )}
            {role === "ASHA" && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {field("ashaId", "ASHA ID", { placeholder: "as on your ID card" })}
                {field("village", "Village / ward")}
                {citySelect("district", "District")}
                {field("phcName", "Primary Health Centre")}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {field("password", "Password", { type: "password", autoComplete: "new-password", placeholder: "8+ characters, a letter and a number" })}
              {field("confirm", "Confirm password", { type: "password", autoComplete: "new-password" })}
            </div>
            <div><Label htmlFor="f-lang">Preferred language</Label><Select id="f-lang" value={f.preferredLanguage} onChange={set("preferredLanguage")}>{LANGS.map((l) => <option key={l} value={l}>{LANG_META[l].native}</option>)}</Select></div>
            {role === "DOCTOR" && <p className="text-xs text-muted">Your registration number is shown as “verification pending” until it is verified.</p>}
            <p className="text-xs text-muted">Do not enter Aadhaar or other ID numbers.</p>
            {error && <p role="alert" className="rounded-lg bg-red-50 p-2.5 text-sm text-bad">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}Register as {ROLE_LABEL[role]}</Button>
          </form>
        </div>
        <AuthAside />
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return <Suspense><RegisterInner /></Suspense>;
}
