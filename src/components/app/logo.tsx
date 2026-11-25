import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="relative grid size-10 place-items-center rounded-xl bg-ink shadow-soft">
        <svg viewBox="0 0 32 32" className="size-6" aria-hidden>
          <rect x="6" y="11" width="4" height="10" rx="2" fill="#6ee5bd" />
          <rect x="14" y="6" width="4" height="20" rx="2" fill="#34d1a0" />
          <rect x="22" y="11" width="4" height="10" rx="2" fill="#6ee5bd" />
        </svg>
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[1.05rem] font-extrabold tracking-tight text-ink">Sushra AI</span>
          <span className="block text-[0.7rem] font-semibold text-muted">Voice-first health assistant</span>
        </span>
      )}
    </span>
  );
}
