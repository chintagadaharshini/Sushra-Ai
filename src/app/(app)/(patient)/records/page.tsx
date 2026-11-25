"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, FileHeart, FlaskConical, HeartHandshake, Pill, Stethoscope, ScanLine, NotebookPen, Search, ShieldCheck, UserRound } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { TryCommand } from "@/components/app/try-command";
import { useAssistant } from "@/lib/voice/store";
import { RECORD_TYPES, RECORD_TYPE_LABEL, formatDate, sourceLabel, type RecordSummaryDTO, type RecordType } from "@/lib/domain";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<RecordType, typeof FileHeart> = {
  LAB_REPORT: FlaskConical,
  PRESCRIPTION: Pill,
  CONSULTATION: Stethoscope,
  IMAGING: ScanLine,
  PATIENT_NOTE: NotebookPen,
  HOME_VISIT: HeartHandshake,
};

function RecordsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [records, setRecords] = useState<RecordSummaryDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<RecordType | "ALL">((params.get("type") as RecordType) ?? "ALL");
  const [q, setQ] = useState(params.get("q") ?? "");
  const flaggedOnly = params.get("flagged") === "1";
  const setRecordsListed = useAssistant((s) => s.setRecordsListed);

  useEffect(() => {
    let alive = true;
    const qs = new URLSearchParams();
    if (type !== "ALL") qs.set("type", type);
    if (q.trim()) qs.set("q", q.trim());
    const t = setTimeout(() => {
      fetch(`/api/records?${qs}`)
        .then(async (r) => {
          if (r.status === 401) return router.push("/login");
          if (!r.ok) throw new Error();
          const d = (await r.json()) as { records: RecordSummaryDTO[] };
          if (alive) { setRecords(d.records); setError(null); }
        })
        .catch(() => alive && setError("Couldn't load your records. Please retry."));
    }, 150);
    return () => { alive = false; clearTimeout(t); };
  }, [type, q, router]);

  const shown = useMemo(() => (records ?? []).filter((r) => !flaggedOnly || r.abnormalCount > 0), [records, flaggedOnly]);

  // Tell the assistant what's on screen so "open the latest one / the second one" works
  useEffect(() => {
    if (records) setRecordsListed(shown.map((r) => r.id));
  }, [shown, records, setRecordsListed]);

  return (
    <div>
      <PageHeader title="My health records" subtitle={<>Newest first. Every record shows who created it — your lab, your doctor, your ASHA worker or you.</>}>
        <TryCommand cmd="Open the latest one" />
      </PageHeader>

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 shadow-soft md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by test, doctor, facility…" aria-label="Search records" className="pl-10" />
        </div>
        <div role="group" aria-label="Filter by record type" className="flex flex-wrap gap-1.5">
          {(["ALL", ...RECORD_TYPES] as const).map((t) => (
            <button key={t} onClick={() => setType(t)} aria-pressed={type === t}
              className={cn("h-10 rounded-xl px-3 text-sm font-semibold cursor-pointer", type === t ? "bg-ink text-white" : "bg-cream text-ink-soft hover:bg-line")}>
              {t === "ALL" ? "All" : RECORD_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
      {flaggedOnly && (
        <p className="mb-3 text-sm text-muted">Showing reports with values outside the lab&apos;s reference range. <Link className="font-semibold text-brand-700 underline" href="/records">Show all</Link></p>
      )}

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-bad">{error}</p>}
      {!records && !error && <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-white" />)}</div>}
      {records && shown.length === 0 && <p className="rounded-2xl border border-line bg-white p-8 text-center text-muted">No records match.</p>}

      <ol className="space-y-2.5" aria-label="Records">
        {shown.map((r, i) => {
          const Icon = TYPE_ICON[r.recordType];
          return (
            <li key={r.id}>
              <Link href={`/records/${r.id}`} data-testid="record-row"
                className="group flex items-center gap-4 rounded-2xl border border-line bg-white p-4 shadow-soft transition hover:border-brand-300">
                <span className="hidden w-6 text-center text-sm font-bold text-muted sm:block" aria-label={`Number ${i + 1}`}>{i + 1}</span>
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-6" aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{r.title}</span>
                  <span className="block text-sm text-muted">{formatDate(r.recordDate)} · {r.facilityName} · {r.authorName}</span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge>{RECORD_TYPE_LABEL[r.recordType]}</Badge>
                    {r.authorType === "PATIENT" ? <Badge tone="warn"><UserRound aria-hidden />Self-reported</Badge> : <Badge tone="brand"><ShieldCheck aria-hidden />{sourceLabel(r)}</Badge>}
                    {r.abnormalCount > 0 && <Badge tone="warn"><AlertCircle aria-hidden />{r.abnormalCount} outside lab range</Badge>}
                    {r.recordType === "LAB_REPORT" && r.abnormalCount === 0 && <Badge tone="brand"><CheckCircle2 aria-hidden />All within range</Badge>}
                  </span>
                </span>
                <ChevronRight className="size-5 text-muted transition group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function RecordsPage() {
  return (
    <Suspense>
      <RecordsInner />
    </Suspense>
  );
}
