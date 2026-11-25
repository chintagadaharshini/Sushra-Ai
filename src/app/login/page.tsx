"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { RoleTabs } from "@/components/auth/role-tabs";
import { AuthAside } from "@/components/auth/auth-aside";
import { ROLE_LABEL, type Role } from "@/lib/domain";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("PATIENT");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier, password, role }) });
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setError((await res.json().catch(() => ({}))).error ?? "Sign-in failed");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-2 lg:py-14">
        <div>
          <Link href="/"><Logo /></Link>
          <h1 className="mt-8 text-4xl font-extrabold tracking-tight">Sign in</h1>
          <p className="mt-2 text-muted">Choose who you are, then sign in with your email or mobile number.</p>
          <form onSubmit={submit} className="mt-6 space-y-5 rounded-2xl border border-line bg-white p-5 shadow-soft" aria-label="Sign in">
            <RoleTabs value={role} onChange={(r) => { setRole(r); setError(null); }} />
            <div><Label htmlFor="identifier">Email or mobile number</Label><Input id="identifier" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required placeholder="name@example.com or 98xxxxxxxx" /></div>
            <div><Label htmlFor="pw">Password</Label><Input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
            {error && <p role="alert" className="rounded-lg bg-red-50 p-2.5 text-sm text-bad">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}Sign in as {ROLE_LABEL[role]}</Button>
            <p className="text-center text-sm text-ink-soft">
              New to Sushra AI? <Link href={`/register?role=${role}`} className="font-bold text-brand-700 hover:underline">Register as {ROLE_LABEL[role]}</Link>
            </p>
            <p className="flex items-start gap-2 text-xs text-muted"><ShieldCheck className="mt-0.5 size-4 shrink-0" />We never ask for your Aadhaar number or OTPs.</p>
          </form>
        </div>
        <AuthAside />
      </div>
    </div>
  );
}
