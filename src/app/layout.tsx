import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource/noto-sans-telugu/400.css";
import "@fontsource/noto-sans-telugu/600.css";
import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-devanagari/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sushra AI — voice-first digital health", template: "%s · Sushra AI" },
  description: "Manage your health records, reports and care by voice in Telugu, Hindi and English. For patients, doctors and ASHA workers.",
};

export const viewport: Viewport = { themeColor: "#0e2338", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-canvas font-sans text-ink">
        <a href="#main" className="skip-link">Skip to main content</a>
        {children}
      </body>
    </html>
  );
}
