import { describe, expect, it } from "vitest";
import { explainRecord } from "@/lib/explain";
import { rangeStatus, type RecordDetailDTO } from "@/lib/domain";

const cbc: RecordDetailDTO = {
  id: "r1", recordType: "LAB_REPORT", category: "blood_test", title: "CBC", recordDate: "2026-11-18T04:00:00Z", facilityName: "Demo Lab",
  authorType: "LABORATORY", authorName: "Demo", source: "DEMO_SEED", verificationStatus: "DEMO_VERIFIED", summary: "", abnormalCount: 1, details: {},
  labResults: [
    { id: "a", testCode: "HGB", testName: "Haemoglobin", value: 10.9, valueText: null, unit: "g/dL", refLow: 12, refHigh: 15.5, refText: null },
    { id: "b", testCode: "WBC", testName: "WBC", value: 7.2, valueText: null, unit: "×10³/µL", refLow: 4, refHigh: 11, refText: null },
    { id: "c", testCode: "XYZ", testName: "Unknown test", value: 3, valueText: null, unit: "u", refLow: null, refHigh: null, refText: null },
  ],
};

describe("report explanation", () => {
  it("flags only values outside the lab's own range", () => {
    const e = explainRecord(cbc, "en");
    expect(e.items.map((i) => i.status)).toEqual(["low", "normal", "unknown"]);
    expect(e.summary).toMatch(/1 of 3 values are outside/);
    expect(e.caution).toMatch(/not a diagnosis/);
    expect(e.caution).toMatch(/qualified doctor/);
  });
  it("produces Telugu and Hindi text with the same facts", () => {
    const te = explainRecord(cbc, "te");
    expect(te.items[0].line).toContain("హిమోగ్లోబిన్");
    expect(te.items[0].line).toContain("10.9");
    expect(te.caution).toContain("డాక్టర్");
    const hi = explainRecord(cbc, "hi");
    expect(hi.items[0].line).toContain("हीमोग्लोबिन");
    expect(hi.summary).toContain("3 में से 1");
  });
  it("never invents a range when the lab gave none", () => {
    const e = explainRecord(cbc, "en");
    expect(e.items[2].rangeDisplay).toBe("—");
    expect(e.items[2].line).toMatch(/not compared/);
  });
  it("non-lab records use their stored plain-language summary, and flag patient-entered data", () => {
    const note: RecordDetailDTO = { ...cbc, recordType: "PATIENT_NOTE", category: "bp_log", authorType: "PATIENT", labResults: [], details: { explain: { en: "Home readings." } } };
    const e = explainRecord(note, "en");
    expect(e.summary).toContain("Home readings.");
    expect(e.summary).toMatch(/not verified by a clinician/);
  });
  it("rangeStatus handles one-sided ranges", () => {
    expect(rangeStatus({ value: 46, refLow: 40, refHigh: null })).toBe("normal");
    expect(rangeStatus({ value: 214, refLow: null, refHigh: 199 })).toBe("high");
    expect(rangeStatus({ value: null, refLow: 1, refHigh: 2 })).toBe("unknown");
  });
});
