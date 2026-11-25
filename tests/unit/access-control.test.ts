// Runs against a real seeded SQLite database (see tests/setup/global-setup.ts).
import { beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { localHealthDataProvider } from "@/server/abdm/local-provider";
import { sandboxHealthDataProvider } from "@/server/abdm/sandbox-provider";
import { AbdmNotConfiguredError } from "@/server/abdm/types";
import { signSession, verifySession, hashPassword, verifyPassword } from "@/server/crypto";
import { preferencePatchSchema, appointmentRequestSchema } from "@/lib/domain";

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: "file:./test.db" }) });
let lakshmi = "", ravi = "";

beforeAll(async () => {
  lakshmi = (await prisma.patientProfile.findFirstOrThrow({ where: { user: { email: "lakshmi@sushra.in" } } })).id;
  ravi = (await prisma.patientProfile.findFirstOrThrow({ where: { user: { email: "ravi@sushra.in" } } })).id;
});

describe("patient access control", () => {
  it("lists only the patient's own records, newest first", async () => {
    const mine = await localHealthDataProvider.listRecords(lakshmi);
    expect(mine.length).toBe(10);
    const dates = mine.map((r) => +new Date(r.recordDate));
    expect([...dates].sort((a, b) => b - a)).toEqual(dates);
    const theirs = await localHealthDataProvider.listRecords(ravi);
    expect(theirs.length).toBe(2);
    expect(mine.some((r) => theirs.find((t) => t.id === r.id))).toBe(false);
  });
  it("cannot fetch another patient's record by id", async () => {
    const raviRecord = (await localHealthDataProvider.listRecords(ravi))[0];
    expect(await localHealthDataProvider.getRecord(lakshmi, raviRecord.id)).toBeNull();
    expect(await localHealthDataProvider.getRecord(ravi, raviRecord.id)).not.toBeNull();
  });
  it("record retrieval returns lab results with source + verification status", async () => {
    const cbc = (await localHealthDataProvider.listRecords(lakshmi, { category: "blood_test" }))[0];
    const detail = await localHealthDataProvider.getRecord(lakshmi, cbc.id);
    expect(detail?.labResults.length).toBe(5);
    expect(detail?.source).toBe("PROVIDER");
    expect(detail?.verificationStatus).toBe("PROVIDER_ISSUED");
    expect(detail?.abnormalCount).toBe(2);
  });
  it("separates patient-reported from clinician data", async () => {
    const all = await localHealthDataProvider.listRecords(lakshmi);
    const note = all.find((r) => r.recordType === "PATIENT_NOTE")!;
    expect(note.authorType).toBe("PATIENT");
    expect(note.verificationStatus).toBe("PATIENT_REPORTED");
  });
  it("search filter works", async () => {
    const r = await localHealthDataProvider.listRecords(lakshmi, { q: "cholesterol" });
    expect(r.map((x) => x.category)).toEqual(["lipid"]);
  });
});

describe("sessions & passwords", () => {
  it("rejects tampered and expired tokens", () => {
    const tok = signSession("u1");
    expect(verifySession(tok)?.uid).toBe("u1");
    const [body, sig] = tok.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "u2", exp: 9e9 })).toString("base64url");
    expect(verifySession(`${forged}.${sig}`)).toBeNull();
    expect(verifySession(`${body}.x${sig.slice(1)}`)).toBeNull();
    expect(verifySession(signSession("u1", -10))).toBeNull();
    expect(verifySession(undefined)).toBeNull();
  });
  it("hashes passwords with salt", () => {
    const h = hashPassword("Demo@1234");
    expect(h).not.toContain("Demo@1234");
    expect(verifyPassword("Demo@1234", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
  });
});

describe("demo mode restrictions", () => {
  it("preference updates only accept whitelisted fields", () => {
    expect(preferencePatchSchema.safeParse({ city: "Hyderabad" }).success).toBe(true);
    expect(preferencePatchSchema.safeParse({ city: "Atlantis" }).success).toBe(false);
    expect(preferencePatchSchema.safeParse({ aadhaar: "123412341234" }).success).toBe(false);
    expect(preferencePatchSchema.safeParse({}).success).toBe(false);
  });
  it("appointment requests are validated strictly", () => {
    expect(appointmentRequestSchema.safeParse({ facilityId: "f", department: "Cardiology", preferredDate: "2026-12-01" }).success).toBe(true);
    expect(appointmentRequestSchema.safeParse({ facilityId: "f", department: "Cardiology", preferredDate: "2026-12-01", status: "CONFIRMED" }).success).toBe(false);
  });
  it("ABDM sandbox adapter refuses instead of calling invented endpoints", async () => {
    await expect(sandboxHealthDataProvider.listRecords("x")).rejects.toBeInstanceOf(AbdmNotConfiguredError);
  });
  it("seed data contains no Aadhaar-like numbers; health IDs are app IDs, not ABHA numbers", async () => {
    const profiles = await prisma.patientProfile.findMany();
    for (const p of profiles) {
      expect(JSON.stringify(p)).not.toMatch(/\b\d{4}\s?\d{4}\s?\d{4}\b/);
      expect(p.healthId).toMatch(/^SU-[A-Z0-9]{6}$/);
    }
  });
});
