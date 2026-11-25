"use client";
import { useState } from "react";
import { formatDate } from "@/lib/domain";

export interface TrendPoint { date: string; value: number }

/**
 * Single-series trend with the lab's reference band. One series → no legend;
 * the card title names it. Hover/focus on a point shows a tooltip.
 */
export function TrendChart({ points, refLow, refHigh, unit, label }: { points: TrendPoint[]; refLow?: number | null; refHigh?: number | null; unit: string; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return <p className="text-sm text-muted">No data yet.</p>;
  const W = 520, H = 180, pad = { l: 40, r: 44, t: 14, b: 28 };
  const vals = points.map((p) => p.value).concat([refLow ?? Infinity, refHigh ?? -Infinity].filter(Number.isFinite) as number[]);
  const min = Math.floor(Math.min(...vals) - 1), max = Math.ceil(Math.max(...vals) + 1);
  const x = (i: number) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (points.length - 1));
  const y = (v: number) => pad.t + ((max - v) * (H - pad.t - pad.b)) / (max - min);
  const ticks = [min, (min + max) / 2, max];
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${label} trend: ${points.map((p) => `${formatDate(p.date)} ${p.value} ${unit}`).join(", ")}`}>
        {refLow != null && refHigh != null && (
          <g>
            <rect x={pad.l} y={y(refHigh)} width={W - pad.l - pad.r} height={y(refLow) - y(refHigh)} fill="#d1faeb" opacity={0.7} />
            <text x={W - pad.r - 4} y={y(refHigh) + 13} textAnchor="end" fontSize="11" fill="#0a755b" fontWeight={600}>Lab reference range</text>
          </g>
        )}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e7e2d9" strokeDasharray="2 4" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#5b6b7b">{Number(t.toFixed(1))}</text>
          </g>
        ))}
        <path d={path} fill="none" stroke="#0a936f" strokeWidth={2} strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.date}>
            <circle cx={x(i)} cy={y(p.value)} r={hover === i ? 7 : 5} fill="#0a936f" stroke="#fff" strokeWidth={2} />
            <circle
              cx={x(i)} cy={y(p.value)} r={18} fill="transparent" tabIndex={0}
              aria-label={`${formatDate(p.date)}: ${p.value} ${unit}`}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
            />
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#5b6b7b">{formatDate(p.date)}</text>
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(points[hover].value) / H) * 100}%`, transform: "translate(-50%, -130%)" }}>
          <b>{points[hover].value} {unit}</b> · {formatDate(points[hover].date)}
        </div>
      )}
    </figure>
  );
}
