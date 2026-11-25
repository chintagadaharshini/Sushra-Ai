import "server-only";
import { prisma } from "../db";
import { rangeStatus, type RecordDetailDTO, type RecordSummaryDTO, type RecordType } from "@/lib/domain";
import type { FacilityDirectory, FacilityDTO, FacilityQuery, HealthDataProvider, RecordQuery } from "./types";

type RecordRow = Awaited<ReturnType<typeof prisma.healthRecord.findFirst>> & {};
type LabRow = { id: string; testCode: string; testName: string; value: number | null; valueText: string | null; unit: string; refLow: number | null; refHigh: number | null; refText: string | null };

function toSummary(r: NonNullable<RecordRow>, labs: LabRow[]): RecordSummaryDTO {
  return {
    id: r.id,
    recordType: r.recordType as RecordType,
    category: r.category,
    title: r.title,
    recordDate: r.recordDate.toISOString(),
    facilityName: r.facilityName,
    authorType: r.authorType,
    authorName: r.authorName,
    source: r.source,
    verificationStatus: r.verificationStatus,
    summary: r.summary,
    abnormalCount: labs.filter((l) => {
      const s = rangeStatus(l);
      return s === "low" || s === "high";
    }).length,
  };
}

export const localHealthDataProvider: HealthDataProvider = {
  mode: "local",
  async listRecords(patientId: string, query: RecordQuery = {}) {
    const q = query.q?.trim().toLowerCase();
    const rows = await prisma.healthRecord.findMany({
      where: {
        patientId, // access control: always scoped to the authenticated patient
        ...(query.recordType ? { recordType: query.recordType } : {}),
        ...(query.category ? { category: query.category } : {}),
      },
      include: { labResults: true },
      orderBy: { recordDate: "desc" },
    });
    return rows
      .filter((r) => !q || `${r.title} ${r.summary} ${r.keywords} ${r.facilityName} ${r.authorName}`.toLowerCase().includes(q))
      .map((r) => toSummary(r, r.labResults));
  },
  async getRecord(patientId: string, recordId: string): Promise<RecordDetailDTO | null> {
    const r = await prisma.healthRecord.findFirst({
      where: { id: recordId, patientId }, // never fetch by id alone
      include: { labResults: { orderBy: { sortOrder: "asc" } } },
    });
    if (!r) return null;
    let details: Record<string, unknown> = {};
    try {
      details = JSON.parse(r.detailsJson);
    } catch {
      details = {};
    }
    return {
      ...toSummary(r, r.labResults),
      details,
      labResults: r.labResults.map((l) => ({
        id: l.id,
        testCode: l.testCode,
        testName: l.testName,
        value: l.value,
        valueText: l.valueText,
        unit: l.unit,
        refLow: l.refLow,
        refHigh: l.refHigh,
        refText: l.refText,
      })),
    };
  },
};

export const localFacilityDirectory: FacilityDirectory = {
  mode: "local",
  async search(query: FacilityQuery): Promise<FacilityDTO[]> {
    const rows = await prisma.facility.findMany({
      where: {
        ...(query.city ? { city: query.city } : {}),
        ...(query.facilityType ? { facilityType: query.facilityType } : {}),
      },
      orderBy: [{ city: "asc" }, { name: "asc" }],
    });
    const q = query.q?.trim().toLowerCase();
    const svc = query.service?.trim().toLowerCase();
    return rows
      .filter((f) => !q || `${f.name} ${f.address} ${f.services}`.toLowerCase().includes(q))
      .filter((f) => !svc || f.services.toLowerCase().includes(svc))
      .map((f) => ({ ...f, services: f.services.split(",").map((s) => s.trim()).filter(Boolean) }));
  },
};
