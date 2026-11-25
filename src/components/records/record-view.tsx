import Link from "next/link";
import { ArrowLeft, Building2, CalendarDays, FileCode2, ShieldCheck, UserRound, HeartHandshake } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RECORD_TYPE_LABEL, formatDate, sourceLabel, type RecordDetailDTO } from "@/lib/domain";
import { LabTable } from "./lab-table";
import { ExplainPanel } from "./explain-panel";
import { SelectRecord } from "./select-record";

type Med = { name: string; dose: string; frequency: string; duration: string };

export function RecordView({ record, backHref, backLabel, llmAvailable, patientName }: { record: RecordDetailDTO; backHref: string; backLabel: string; llmAvailable: boolean; patientName?: string }) {
  const d = record.details as { chiefComplaint?: string; clinicianNotes?: string; plan?: string[]; followUp?: string; medications?: Med[]; findings?: string; impression?: string; readings?: { date: string; value: string }[]; vitals?: { bp?: string; weight?: string; sugar?: string }; notes?: string };

  return (
    <div>
      <SelectRecord id={record.id} />
      <Link href={backHref} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> {backLabel}
      </Link>
      {patientName && <p className="mb-1 text-sm font-semibold text-muted">Patient: {patientName}</p>}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            <Badge>{RECORD_TYPE_LABEL[record.recordType]}</Badge>
            {record.authorType === "PATIENT" ? (
              <Badge tone="warn"><UserRound aria-hidden />Self-reported · not checked by a doctor</Badge>
            ) : record.authorType === "ASHA" ? (
              <Badge tone="brand"><HeartHandshake aria-hidden />{sourceLabel(record)}</Badge>
            ) : (
              <Badge tone="brand"><ShieldCheck aria-hidden />{sourceLabel(record)}</Badge>
            )}
          </div>
          <h1 className="text-[1.75rem] font-extrabold tracking-tight" data-testid="record-title">{record.title}</h1>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[0.95rem] text-muted">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" aria-hidden />{formatDate(record.recordDate)}</span>
            <span className="inline-flex items-center gap-1.5"><Building2 className="size-4" aria-hidden />{record.facilityName}</span>
            <span className="inline-flex items-center gap-1.5"><UserRound className="size-4" aria-hidden />{record.authorName}</span>
          </p>
        </div>
        <a href={`/api/records/${record.id}/fhir`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-semibold hover:bg-cream" title="Download as an HL7 FHIR R4 Bundle (JSON)">
          <FileCode2 className="size-4" aria-hidden /> FHIR R4 JSON
        </a>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-3">
          <Card>
            <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
            <CardContent><p className="text-[0.95rem] text-ink-soft">{record.summary}</p></CardContent>
          </Card>

          {record.labResults.length > 0 && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Results</CardTitle>
                  <p className="text-sm text-muted">Compared only against the reference range printed by the lab.</p>
                </div>
              </CardHeader>
              <CardContent><LabTable results={record.labResults} /></CardContent>
            </Card>
          )}

          {(d.chiefComplaint || d.plan) && (
            <Card>
              <CardHeader><CardTitle>Consultation notes <span className="text-sm font-normal text-muted">(clinician-authored)</span></CardTitle></CardHeader>
              <CardContent className="space-y-3 text-[0.95rem]">
                {d.chiefComplaint && <p><b>Reason for visit:</b> {d.chiefComplaint}</p>}
                {d.clinicianNotes && <p><b>Notes:</b> {d.clinicianNotes}</p>}
                {d.plan && (<div><b>Plan:</b><ul className="ml-5 mt-1 list-disc">{d.plan.map((p) => <li key={p}>{p}</li>)}</ul></div>)}
                {d.followUp && <p><b>Follow-up:</b> {d.followUp}</p>}
              </CardContent>
            </Card>
          )}

          {d.medications && (
            <Card>
              <CardHeader><CardTitle>Medicines prescribed</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[0.95rem]">
                    <thead className="text-sm text-muted"><tr><th className="py-2 pr-3">Medicine</th><th className="pr-3">Dose</th><th className="pr-3">When</th><th>Duration</th></tr></thead>
                    <tbody>{d.medications.map((m) => (<tr key={m.name} className="border-t border-line"><td className="py-2.5 pr-3 font-semibold">{m.name}</td><td className="pr-3">{m.dose}</td><td className="pr-3">{m.frequency}</td><td>{m.duration}</td></tr>))}</tbody>
                  </table>
                </div>
                <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-warn">Take medicines only as your doctor wrote. Don&apos;t start, stop or change any medicine without asking your doctor or pharmacist.</p>
              </CardContent>
            </Card>
          )}

          {(d.findings || d.impression) && (
            <Card>
              <CardHeader><CardTitle>Radiology report</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-[0.95rem]">
                {d.findings && <p><b>Findings:</b> {d.findings}</p>}
                {d.impression && <p><b>Impression:</b> {d.impression}</p>}
              </CardContent>
            </Card>
          )}

          {d.readings && (
            <Card>
              <CardHeader><CardTitle>Self-entered readings</CardTitle></CardHeader>
              <CardContent>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {d.readings.map((r) => (<li key={r.date} className="rounded-xl bg-cream p-3"><p className="text-xs text-muted">{formatDate(r.date)}</p><p className="font-bold">{r.value} <span className="text-xs font-normal">mmHg</span></p></li>))}
                </ul>
              </CardContent>
            </Card>
          )}
          {(d.vitals || (record.recordType === "HOME_VISIT" && d.notes)) && (
            <Card>
              <CardHeader><CardTitle>Home visit readings</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {d.vitals?.bp && <li className="rounded-xl bg-cream p-3"><p className="text-xs text-muted">Blood pressure</p><p className="font-bold">{d.vitals.bp}</p></li>}
                  {d.vitals?.weight && <li className="rounded-xl bg-cream p-3"><p className="text-xs text-muted">Weight</p><p className="font-bold">{d.vitals.weight}</p></li>}
                  {d.vitals?.sugar && <li className="rounded-xl bg-cream p-3"><p className="text-xs text-muted">Blood sugar</p><p className="font-bold">{d.vitals.sugar}</p></li>}
                </ul>
                {d.notes && <p className="text-[0.95rem]"><b>Notes:</b> {d.notes}</p>}
              </CardContent>
            </Card>
          )}
        </div>
        <div className="xl:col-span-2">
          <ExplainPanel recordId={record.id} llmAvailable={llmAvailable} isLab={record.labResults.length > 0} />
        </div>
      </div>
    </div>
  );
}
