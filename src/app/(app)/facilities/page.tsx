"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Building2, ChevronDown, Clock, MapPin, Phone, Search, Stethoscope } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { TryCommand } from "@/components/app/try-command";
import { useAssistant } from "@/lib/voice/store";
import { CITIES, FACILITY_TYPES, FACILITY_TYPE_LABEL, type FacilityType } from "@/lib/domain";
import type { FacilityDTO } from "@/server/abdm/types";
import { cn } from "@/lib/utils";

const CATEGORIES = ["General Medicine", "Cardiology", "Ophthalmology", "Orthopaedics", "Paediatrics", "Gynaecology", "Emergency", "Blood tests", "X-ray"];

function FacilitiesInner() {
  const params = useSearchParams();
  const router = useRouter();
  const city = params.get("city") ?? "";
  const type = params.get("type") ?? "";
  const [q, setQ] = useState(params.get("q") ?? "");
  const [service, setService] = useState(params.get("service") ?? "");
  const [results, setResults] = useState<FacilityDTO[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const publish = useAssistant((s) => s.setFacilityResult);

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set(k, v); else next.delete(k);
    router.replace(`/facilities?${next}`);
  };

  useEffect(() => {
    let alive = true;
    const qs = new URLSearchParams();
    if (city) qs.set("city", city);
    if (type) qs.set("type", type);
    if (q.trim()) qs.set("q", q.trim());
    if (service) qs.set("service", service);
    const t = setTimeout(() => {
      fetch(`/api/facilities?${qs}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: { facilities: FacilityDTO[] }) => {
          if (!alive) return;
          setResults(d.facilities);
          if (!q.trim() && !service) publish(`${city}|${type}`, d.facilities.length); // lets the voice assistant verify the search ran
        })
        .catch(() => alive && setResults([]));
    }, 120);
    return () => { alive = false; clearTimeout(t); };
  }, [city, type, q, service, publish]);

  return (
    <div>
      <PageHeader title="Healthcare facilities" subtitle="Find hospitals, clinics, health centres, labs and pharmacies.">
        <TryCommand cmd="Find hospitals near Visakhapatnam" />
      </PageHeader>


      <form onSubmit={(e) => e.preventDefault()} className="mb-5 grid gap-3 rounded-2xl border border-line bg-white p-4 shadow-soft md:grid-cols-4" aria-label="Facility search">
        <div>
          <Label htmlFor="f-city">City</Label>
          <Select id="f-city" value={city} onChange={(e) => setParam("city", e.target.value)}>
            <option value="">All cities</option>
            {CITIES.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.te} · {c.hi}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="f-type">Facility type</Label>
          <Select id="f-type" value={type} onChange={(e) => setParam("type", e.target.value)}>
            <option value="">All types</option>
            {FACILITY_TYPES.map((t) => <option key={t} value={t}>{FACILITY_TYPE_LABEL[t]}</option>)}
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="f-q">Name or area</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted" aria-hidden />
            <Input id="f-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Krishna, Beach Road" className="pl-10" />
          </div>
        </div>
        <div className="md:col-span-4">
          <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Service categories</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Service categories">
            {CATEGORIES.map((c) => (
              <button type="button" key={c} onClick={() => setService(service === c ? "" : c)} aria-pressed={service === c}
                className={cn("h-9 rounded-full px-3 text-sm font-semibold cursor-pointer", service === c ? "bg-ink text-white" : "bg-cream text-ink-soft hover:bg-line")}>{c}</button>
            ))}
          </div>
        </div>
      </form>

      <p className="mb-3 text-sm font-semibold text-muted" aria-live="polite" data-testid="facility-count">
        {results ? `${results.length} ${results.length === 1 ? "facility" : "facilities"}${city ? ` in ${city}` : ""}${type ? ` · ${FACILITY_TYPE_LABEL[type as FacilityType]}` : ""}` : "Searching…"}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {results?.map((f) => (
          <article key={f.id} className="rounded-2xl border border-line bg-white p-4 shadow-soft" data-testid="facility-card">
            <div className="flex items-start gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Building2 className="size-6" aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold">{f.name}</h2>
                <p className="flex items-center gap-1 text-sm text-muted"><MapPin className="size-3.5" aria-hidden />{f.address}, {f.city}, {f.state}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge>{FACILITY_TYPE_LABEL[f.facilityType as FacilityType]}</Badge>
                  <Badge tone={f.ownership === "GOVERNMENT" ? "brand" : "neutral"}>{f.ownership === "GOVERNMENT" ? "Government" : "Private"}</Badge>
                </div>
              </div>
            </div>
            <button onClick={() => setOpenId(openId === f.id ? null : f.id)} aria-expanded={openId === f.id}
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 cursor-pointer">
              Facility details <ChevronDown className={cn("size-4 transition", openId === f.id && "rotate-180")} aria-hidden />
            </button>
            {openId === f.id && (
              <div className="mt-2 space-y-1.5 rounded-xl bg-canvas p-3 text-sm">
                <p className="flex items-start gap-2"><Stethoscope className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden /><span><b>Services:</b> {f.services.join(", ")}</span></p>
                <p className="flex items-center gap-2"><Clock className="size-4 text-muted" aria-hidden /><b>Hours:</b> {f.openHours}</p>
                {f.phone && <p className="flex items-center gap-2"><Phone className="size-4 text-muted" aria-hidden /><b>Phone:</b> {f.phone}</p>}
                <Link href={`/appointments?new=1&facility=${f.id}`}><Button size="sm" variant="brand" className="mt-2">Request an appointment</Button></Link>
              </div>
            )}
          </article>
        ))}
      </div>
      {results && results.length === 0 && <p className="rounded-2xl border border-line bg-white p-8 text-center text-muted">No facilities match. Try another city such as Hyderabad or Visakhapatnam.</p>}
    </div>
  );
}

export default function FacilitiesPage() {
  return <Suspense><FacilitiesInner /></Suspense>;
}
