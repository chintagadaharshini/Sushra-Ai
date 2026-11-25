import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badge = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&_svg]:size-3.5", {
  variants: {
    tone: {
      neutral: "bg-cream text-ink-soft",
      brand: "bg-brand-50 text-brand-800 ring-1 ring-brand-200",
      warn: "bg-amber-50 text-warn ring-1 ring-amber-200",
      bad: "bg-red-50 text-bad ring-1 ring-red-200",
      ink: "bg-ink text-white",
      info: "bg-violet-50 text-violet-800 ring-1 ring-violet-200",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...p} />;
}
