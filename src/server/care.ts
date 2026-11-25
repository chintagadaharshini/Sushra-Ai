import "server-only";
// Consent-based access for doctors and ASHA workers. A care-team member can see a
// patient's records only while that patient has an active CARE_ACCESS consent for them.
import { prisma } from "./db";
import type { SessionUser } from "./session";
import { getHealthDataProvider } from "./abdm";
import type { RecordDetailDTO } from "@/lib/domain";

export async function activeCareConsent(granteeUserId: string, patientId: string) {
  return prisma.consentRecord.findFirst({
    where: {
      patientId,
      grantedToUserId: granteeUserId,
      purpose: "CARE_ACCESS",
      status: "GRANTED",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
}

export async function canViewPatient(user: Pick<SessionUser, "id" | "role" | "profile">, patientId: string): Promise<boolean> {
  if (user.role === "PATIENT") return user.profile?.id === patientId;
  return Boolean(await activeCareConsent(user.id, patientId));
}

/** Patients who currently share their records with this doctor / ASHA worker. */
export async function listCarePatients(granteeUserId: string, q?: string) {
  const consents = await prisma.consentRecord.findMany({
    where: { grantedToUserId: granteeUserId, purpose: "CARE_ACCESS", status: "GRANTED", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    include: { patient: { include: { records: { orderBy: { recordDate: "desc" }, take: 1, select: { recordDate: true, title: true } }, _count: { select: { records: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  const seen = new Set<string>();
  const needle = q?.trim().toLowerCase();
  return consents
    .filter((c) => (seen.has(c.patientId) ? false : (seen.add(c.patientId), true)))
    .filter((c) => !needle || `${c.patient.fullName} ${c.patient.city ?? ""} ${c.patient.healthId}`.toLowerCase().includes(needle))
    .map((c) => ({
      patientId: c.patientId,
      fullName: c.patient.fullName,
      gender: c.patient.gender,
      yearOfBirth: c.patient.yearOfBirth,
      city: c.patient.city,
      healthId: c.patient.healthId,
      recordCount: c.patient._count.records,
      lastRecord: c.patient.records[0] ? { title: c.patient.records[0].title, date: c.patient.records[0].recordDate.toISOString() } : null,
      accessUntil: c.expiresAt?.toISOString() ?? null,
      scope: c.scope,
    }));
}

/** Fetch a record for whoever is viewing: the patient themselves, or a consented care-team member. */
export async function getRecordForViewer(user: SessionUser, recordId: string): Promise<RecordDetailDTO | null> {
  if (user.role === "PATIENT") return getHealthDataProvider().getRecord(user.profile!.id, recordId);
  const row = await prisma.healthRecord.findUnique({ where: { id: recordId }, select: { patientId: true } });
  if (!row || !(await activeCareConsent(user.id, row.patientId))) return null;
  return getHealthDataProvider().getRecord(row.patientId, recordId);
}
