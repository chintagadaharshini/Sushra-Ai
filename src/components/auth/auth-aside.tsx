import { FileHeart, Languages, ShieldCheck, Stethoscope } from "lucide-react";

export function AuthAside() {
  return (
    <div className="relative hidden overflow-hidden rounded-3xl bg-ink p-8 text-white lg:block">
      <div className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-brand-400/30 blur-3xl" aria-hidden />
      <div className="relative">
        <div className="mx-auto flex h-36 items-center justify-center gap-3" aria-hidden>
          {[80, 128, 80].map((h, i) => <span key={i} className="w-12 rounded-full bg-gradient-to-b from-brand-300 via-brand-400 to-brand-500 shadow-[0_0_40px_rgb(52_209_160/.6)]" style={{ height: h }} />)}
        </div>
        <h2 className="mt-6 text-2xl font-extrabold">Health care you can talk to</h2>
        <p className="mt-2 text-slate-300">Speak in Telugu, Hindi or English. Sushra AI opens your records, explains reports in simple words and connects you with your doctor and ASHA worker.</p>
        <ul className="mt-6 space-y-3 text-[0.95rem]">
          {[
            { i: Languages, t: "తెలుగు · हिन्दी · English voice" },
            { i: FileHeart, t: "Reports explained in plain language" },
            { i: Stethoscope, t: "Doctors & ASHA workers see records only when you share" },
            { i: ShieldCheck, t: "We never ask for Aadhaar or OTPs" },
          ].map(({ i: I, t }) => (
            <li key={t} className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-white/10"><I className="size-4.5 text-brand-300" /></span>{t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
