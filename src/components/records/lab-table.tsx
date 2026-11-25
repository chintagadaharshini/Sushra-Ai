import { ArrowDown, ArrowUp, Check, Minus } from "lucide-react";
import { rangeStatus, type LabResultDTO } from "@/lib/domain";
import { formatRange } from "@/lib/explain";
import { cn } from "@/lib/utils";

const STATUS = {
  low: { label: "Below range", icon: ArrowDown, cls: "bg-amber-50 text-warn ring-amber-200" },
  high: { label: "Above range", icon: ArrowUp, cls: "bg-amber-50 text-warn ring-amber-200" },
  normal: { label: "Within range", icon: Check, cls: "bg-brand-50 text-brand-800 ring-brand-200" },
  unknown: { label: "No range given", icon: Minus, cls: "bg-cream text-ink-soft ring-line" },
};

/** Position of the value against the lab's own range (one-sided ranges handled). */
function RangeBar({ r }: { r: LabResultDTO }) {
  if (r.value == null || (r.refLow == null && r.refHigh == null)) return null;
  const lo = r.refLow ?? Math.min(r.value, r.refHigh!) * 0.5;
  const hi = r.refHigh ?? Math.max(r.value, r.refLow!) * 1.5;
  const span = hi - lo;
  const min = lo - span * 0.5, max = hi + span * 0.5;
  const pct = (v: number) => Math.max(2, Math.min(98, ((v - min) / (max - min)) * 100));
  const s = rangeStatus(r);
  return (
    <div className="relative mt-2 h-2 w-full max-w-56 rounded-full bg-cream" aria-hidden>
      <div className="absolute inset-y-0 rounded-full bg-brand-200" style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }} />
      <div className={cn("absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white", s === "normal" ? "bg-brand-600" : "bg-warn")} style={{ left: `${pct(r.value)}%` }} />
    </div>
  );
}

export function LabTable({ results }: { results: LabResultDTO[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="text-sm text-muted">
          <tr><th className="py-2 pr-4">Test</th><th className="pr-4">Your value</th><th className="pr-4">Lab reference range</th><th>Status</th></tr>
        </thead>
        <tbody>
          {results.map((r) => {
            const st = STATUS[rangeStatus(r)];
            const Icon = st.icon;
            return (
              <tr key={r.id} className="border-t border-line align-top">
                <td className="py-3 pr-4 font-semibold">{r.testName}<RangeBar r={r} /></td>
                <td className="py-3 pr-4 text-lg font-bold">{r.value ?? r.valueText} <span className="text-sm font-normal text-muted">{r.unit}</span></td>
                <td className="py-3 pr-4 text-sm text-ink-soft">{formatRange(r)}</td>
                <td className="py-3"><span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1", st.cls)}><Icon className="size-3.5" aria-hidden />{st.label}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
