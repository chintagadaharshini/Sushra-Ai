"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, FileHeart, HelpCircle, Hospital, LayoutDashboard, LogOut, Menu, Search, ShieldCheck, UserRound, X, AArrowUp, Mic, Users, UserPlus } from "lucide-react";
import { Logo } from "./logo";
import { VoiceAssistant } from "@/components/assistant/voice-assistant";
import { useAssistant } from "@/lib/voice/store";
import { LANGS, LANG_META, ROLE_LABEL, type Lang, type Role, type TextScale } from "@/lib/domain";
import { cn } from "@/lib/utils";

const NAV_BY_ROLE: Record<Role, { href: string; label: string; icon: typeof LayoutDashboard }[]> = {
  PATIENT: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/records", label: "Health Records", icon: FileHeart },
    { href: "/facilities", label: "Facilities", icon: Hospital },
    { href: "/appointments", label: "Appointments", icon: CalendarDays },
    { href: "/profile", label: "Profile & Preferences", icon: UserRound },
    { href: "/privacy", label: "Privacy & Sharing", icon: ShieldCheck },
    { href: "/help", label: "Help & Voice Guide", icon: HelpCircle },
  ],
  DOCTOR: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/patients", label: "My Patients", icon: Users },
    { href: "/facilities", label: "Facilities", icon: Hospital },
    { href: "/profile", label: "Profile & Preferences", icon: UserRound },
    { href: "/privacy", label: "Privacy", icon: ShieldCheck },
    { href: "/help", label: "Help & Voice Guide", icon: HelpCircle },
  ],
  ASHA: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/patients", label: "My Patients", icon: Users },
    { href: "/patients/register", label: "Register Patient", icon: UserPlus },
    { href: "/facilities", label: "Facilities", icon: Hospital },
    { href: "/profile", label: "Profile & Preferences", icon: UserRound },
    { href: "/privacy", label: "Privacy", icon: ShieldCheck },
    { href: "/help", label: "Help & Voice Guide", icon: HelpCircle },
  ],
};

export interface ShellPrefs {
  preferredLanguage: Lang;
  textScale: TextScale;
  highContrast: boolean;
  voiceResponses: boolean;
}

export function applyDisplayPrefs(p: { textScale?: string; highContrast?: boolean }) {
  const el = document.documentElement;
  if (p.textScale) el.dataset.textScale = p.textScale;
  if (p.highContrast !== undefined) el.dataset.contrast = p.highContrast ? "high" : "normal";
}

export function AppShell({ user, prefs, children }: { user: { displayName: string; fullName: string; role: Role }; prefs: ShellPrefs; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [q, setQ] = useState("");
  const { lang, setLang, setPathname, setVoiceOn, setOpen, setRole } = useAssistant();
  const NAV = NAV_BY_ROLE[user.role];

  // Initial preferences (once per session)
  useEffect(() => {
    applyDisplayPrefs(prefs);
    setRole(user.role);
    setLang(prefs.preferredLanguage);
    setVoiceOn(prefs.voiceResponses);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = LANG_META[lang].bcp47;
  }, [lang]);

  useEffect(() => {
    setPathname(pathname);
    setMobileOpen(false);
  }, [pathname, setPathname]);

  const cycleText = () => {
    const order: TextScale[] = ["normal", "large", "xlarge"];
    const cur = (document.documentElement.dataset.textScale as TextScale) || "normal";
    applyDisplayPrefs({ textScale: order[(order.indexOf(cur) + 1) % order.length] });
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    useAssistant.getState().clearConversation();
    router.push("/login");
    router.refresh();
  };

  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (pathname.startsWith(href + "/") && !NAV.some((n) => n.href !== href && n.href.startsWith(href + "/") && pathname.startsWith(n.href)));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3.5 py-3 text-[0.95rem] font-semibold transition-colors",
              active ? "bg-ink text-white shadow-soft" : "text-ink-soft hover:bg-cream",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-dvh">
      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-68 shrink-0 flex-col border-r border-line bg-white/70 px-4 py-5 backdrop-blur lg:flex">
          <Link href="/dashboard" className="mb-7 px-2"><Logo /></Link>
          {nav}
          <div className="mt-auto rounded-2xl bg-gradient-to-br from-brand-50 to-white p-4 ring-1 ring-brand-100">
            <p className="text-sm font-bold text-ink">Talk instead of tapping</p>
            <p className="mt-1 text-xs text-muted">Telugu · हिन्दी · English</p>
            <button onClick={() => setOpen(true)} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 cursor-pointer">
              <Mic className="size-4" aria-hidden /> Open assistant
            </button>
          </div>
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <button className="absolute inset-0 bg-ink/40" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-white p-5 shadow-xl">
              <div className="mb-6 flex items-center justify-between">
                <Logo />
                <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="grid size-11 place-items-center rounded-xl hover:bg-cream cursor-pointer"><X /></button>
              </div>
              {nav}
            </div>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-canvas/85 px-4 py-3 backdrop-blur md:px-8">
            <button className="grid size-11 place-items-center rounded-xl border border-line bg-white lg:hidden cursor-pointer" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
              <Menu />
            </button>
            <form
              role="search"
              className="relative hidden max-w-md flex-1 md:block"
              onSubmit={(e) => {
                e.preventDefault();
                const base = user.role === "PATIENT" ? "/records" : "/patients";
                router.push(`${base}${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
              }}
            >
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label={user.role === "PATIENT" ? "Search your health records" : "Search your patients"}
                placeholder={user.role === "PATIENT" ? "Search records — e.g. cholesterol, CBC…" : "Search patients by name, village or Health ID…"}
                className="h-11 w-full rounded-xl border border-line bg-white pl-10 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
            </form>
            <div className="ml-auto flex items-center gap-2">
              <div role="group" aria-label="Assistant language" className="hidden items-center rounded-xl border border-line bg-white p-1 sm:flex">
                {LANGS.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    aria-pressed={lang === l}
                    title={LANG_META[l].label}
                    className={cn("h-9 min-w-11 rounded-lg px-2 text-sm font-bold cursor-pointer", lang === l ? "bg-ink text-white" : "text-ink-soft hover:bg-cream")}
                  >
                    {LANG_META[l].short}
                  </button>
                ))}
              </div>
              <button onClick={cycleText} className="grid size-11 place-items-center rounded-xl border border-line bg-white hover:bg-cream cursor-pointer" aria-label="Change text size" title="Text size">
                <AArrowUp className="size-5" />
              </button>
              <div className="hidden items-center gap-2.5 rounded-xl border border-line bg-white py-1 pl-1 pr-3 md:flex">
                <span className="grid size-9 place-items-center rounded-lg bg-brand-100 font-bold text-brand-800" aria-hidden>{user.displayName[0]}</span>
                <span className="leading-tight">
                  <span className="block text-sm font-semibold">{user.displayName}</span>
                  <span className="block text-[0.7rem] font-semibold text-brand-700">{ROLE_LABEL[user.role]}</span>
                </span>
              </div>
              <button onClick={logout} className="grid size-11 place-items-center rounded-xl border border-line bg-white hover:bg-cream cursor-pointer" aria-label="Sign out" title="Sign out">
                <LogOut className="size-5" />
              </button>
            </div>
          </header>
          <main id="main" className="mx-auto w-full max-w-7xl px-4 pb-36 pt-6 md:px-8">
            {children}
          </main>
        </div>
      </div>
      <VoiceAssistant userName={user.displayName} />
    </div>
  );
}
