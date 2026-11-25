import Link from "next/link";
import { ArrowRight, Building2, FileHeart, Languages, Lock, Mic, ShieldCheck, Sparkles, Hand, Stethoscope } from "lucide-react";
import { Logo } from "@/components/app/logo";

const FEATURES = [
  { icon: Mic, t: "Speak, don't search menus", d: "Ask in Telugu, Hindi or English. The assistant performs the real action — opening a report, filtering hospitals, filling a form." },
  { icon: Sparkles, t: "Reports in plain words", d: "Lab values explained in your language, compared only with the lab's own reference ranges. Educational, never a diagnosis." },
  { icon: Hand, t: "You stay in control", d: "Every change is confirmed first. Bookings and consents need your own tap. Passwords, OTPs and Aadhaar are refused." },
  { icon: FileHeart, t: "Records with provenance", d: "Each record shows who authored it — lab, clinician or you — and whether it is verified." },
  { icon: Building2, t: "Find care nearby", d: "Search hospitals, clinics, PHCs, labs and pharmacies by city and service." },
  { icon: Languages, t: "Built for everyone", d: "Large buttons, adjustable text, high contrast and keyboard navigation for elderly users." },
  { icon: Stethoscope, t: "Doctors & ASHA workers", d: "Care teams see a patient's records only after the patient shares them — and can add notes, prescriptions and home visits." },
];

export default function Landing() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <Link href="/login" className="inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-4 font-semibold text-white hover:bg-ink-soft">Sign in <ArrowRight className="size-4" /></Link>
      </header>
      <main id="main">
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-8 lg:grid-cols-2 lg:pt-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-800 ring-1 ring-brand-200">Theme 03 · HealthTech & Bio-Innovation</p>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight md:text-6xl">
              Your health records,<br /><span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">just ask.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-soft">
              Sushra AI is a voice-first digital health app built for elders, rural families, regional-language speakers — and the doctors and ASHA workers who care for them.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-[1.05rem] font-semibold">
              <span className="rounded-xl bg-white px-3 py-2 shadow-soft ring-1 ring-line" lang="te">“నా హెల్త్ రికార్డ్స్ చూపించు”</span>
              <span className="rounded-xl bg-white px-3 py-2 shadow-soft ring-1 ring-line" lang="hi">“मेरी रिपोर्ट समझाओ”</span>
              <span className="rounded-xl bg-white px-3 py-2 shadow-soft ring-1 ring-line">“Find hospitals in Vizag”</span>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="inline-flex h-13 items-center gap-2 rounded-xl bg-brand-600 px-6 text-base font-bold text-white hover:bg-brand-700"><Mic className="size-5" />Get started</Link>
              <Link href="/login" className="inline-flex h-13 items-center rounded-xl border border-line bg-white px-6 text-base font-semibold hover:bg-cream">Sign in</Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute inset-0 -z-10 m-auto size-80 rounded-full bg-brand-300/40 blur-3xl" aria-hidden />
            <div className="rounded-[2.5rem] border border-line bg-gradient-to-b from-brand-50 to-white p-6 shadow-2xl">
              <div className="mx-auto flex h-44 items-center justify-center gap-3" aria-hidden>
                {[96, 150, 96].map((h, i) => <span key={i} className="w-14 rounded-full bg-gradient-to-b from-brand-300 via-brand-400 to-brand-500 shadow-[0_0_40px_rgb(52_209_160/.6)]" style={{ height: h }} />)}
              </div>
              <p className="mt-4 text-center text-xl font-semibold text-ink" lang="te">నా తాజా బ్లడ్ టెస్ట్ రిపోర్ట్ తెరువు</p>
              <div className="mt-4 rounded-2xl border border-line bg-white p-3 text-sm">
                <p className="font-semibold" lang="te">మీ తాజా బ్లడ్ టెస్ట్ రిపోర్ట్ తెరుస్తున్నాను…</p>
                <p className="mt-1 text-muted">→ Opens your latest Complete Blood Count report</p>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="bg-white py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-3xl font-extrabold tracking-tight">A real voice layer, not a chatbot</h2>
            <p className="mt-2 max-w-2xl text-muted">Speech → intent → validation → confirmation → action → verification → spoken reply. Each step is checked, and the assistant never claims success it didn&apos;t verify.</p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {FEATURES.map(({ icon: I, t, d }) => (
                <div key={t} className="rounded-2xl border border-line bg-canvas p-5">
                  <span className="grid size-11 place-items-center rounded-xl bg-brand-100 text-brand-800"><I className="size-5" /></span>
                  <h3 className="mt-3 font-bold">{t}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex flex-wrap items-start gap-4 rounded-2xl border border-line bg-white p-6">
            <Lock className="size-6 text-brand-700" />
            <div className="flex-1 text-sm text-ink-soft">
              <p className="font-bold text-ink">Important</p>
              Sushra AI is an independent app. It is not affiliated with or endorsed by the National Health Authority, ABDM or the ABHA system. To create or manage your ABHA, use official channels such as <a className="font-semibold text-brand-700 underline" href="https://abha.abdm.gov.in" target="_blank" rel="noreferrer">abha.abdm.gov.in</a>.
            </div>
            <ShieldCheck className="size-6 text-brand-700" />
          </div>
        </section>
      </main>
    </div>
  );
}
