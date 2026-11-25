import { redirect } from "next/navigation";
import { displayNameOf, getSessionUser } from "@/server/session";
import { AppShell } from "@/components/app/app-shell";
import type { Lang, TextScale } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const prefs = user.preferences;
  return (
    <AppShell
      user={{ displayName: user.displayName, fullName: displayNameOf(user), role: user.role }}
      prefs={{
        preferredLanguage: (prefs?.preferredLanguage ?? "en") as Lang,
        textScale: (prefs?.textScale ?? "normal") as TextScale,
        highContrast: prefs?.highContrast ?? false,
        voiceResponses: prefs?.voiceResponses ?? true,
      }}
    >
      {children}
    </AppShell>
  );
}
