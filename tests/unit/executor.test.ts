import { describe, expect, it, vi } from "vitest";
import { handleUtterance, resolveRecord, type ExecDeps } from "@/lib/voice/executor";
import type { ConversationContext } from "@/lib/voice/store";
import type { FormBridge, FormId } from "@/lib/voice/form-bridge";
import type { RecordSummaryDTO, Lang } from "@/lib/domain";
import type { Explanation } from "@/lib/explain";

const rec = (id: string, category: string, date: string, recordType = "LAB_REPORT"): RecordSummaryDTO => ({
  id, category, recordType: recordType as RecordSummaryDTO["recordType"], title: `${category} ${date}`, recordDate: date,
  facilityName: "Demo", authorType: "LABORATORY", authorName: "Demo", source: "DEMO_SEED", verificationStatus: "DEMO_VERIFIED", summary: "", abnormalCount: 0,
});
const RECORDS = [
  rec("cbc-new", "blood_test", "2026-11-18T04:00:00Z"),
  rec("sugar", "diabetes", "2026-11-18T03:45:00Z"),
  rec("bp", "bp_log", "2026-11-10T14:00:00Z", "PATIENT_NOTE"),
  rec("cbc-old", "blood_test", "2026-04-12T03:00:00Z"),
];

function harness(opts: { lang?: Lang; path?: string; saveImpl?: FormBridge["save"]; navWorks?: boolean } = {}) {
  let path = opts.path ?? "/dashboard";
  let lang: Lang = opts.lang ?? "en";
  let ctx: ConversationContext = { visibleRecordIds: [] };
  const forms = new Map<FormId, FormBridge>();
  const formState: Record<string, unknown> = { city: "Vijayawada" };
  const prefForm: FormBridge = {
    id: "preferences",
    fields: ["city", "preferredLanguage", "textScale", "voiceResponses"],
    getDisplay: (f) => String(formState[f]),
    setField: vi.fn((f, v) => { formState[f] = v; }),
    save: opts.saveImpl ?? vi.fn(async (_f, v) => v),
  };
  const audits: string[] = [];
  const explain = vi.fn(async (id: string, l: Lang): Promise<Explanation> => ({ recordId: id, lang: l, mode: "deterministic", intro: `intro-${l}`, items: [], summary: "s", caution: "c", spoken: `spoken-${id}-${l}` }));
  const deps: ExecDeps = {
    get lang() { return lang; },
    get ctx() { return ctx; },
    setCtx: (p) => { ctx = { ...ctx, ...p }; },
    setLang: (l) => { lang = l; },
    pathname: () => path,
    navigate: (p) => {
      if (opts.navWorks === false) return;
      path = p.split("?")[0];
      if (path === "/profile") forms.set("preferences", prefForm);
      if (path === "/records") ctx = { ...ctx, visibleRecordIds: RECORDS.map((r) => r.id) };
    },
    back: vi.fn(),
    waitFor: async (pred) => pred(),
    scroll: () => "moved",
    forms: { get: (id) => forms.get(id) },
    facilityResult: () => undefined,
    api: { listRecords: async () => RECORDS, explain, audit: (a) => { audits.push(a); } },
    now: () => 0,
  };
  return { deps, get path() { return path; }, get ctx() { return ctx; }, get lang() { return lang; }, formState, prefForm, audits, explain };
}

describe("conversational context (Scenario 6)", () => {
  it("records → latest one → explain it in Telugu", async () => {
    const h = harness();
    const r1 = await handleUtterance("Open my records.", h.deps);
    expect(h.path).toBe("/records");
    expect(r1.say).toMatch(/Opening your health records/);

    const r2 = await handleUtterance("Open the latest one.", h.deps);
    expect(h.path).toBe("/records/cbc-new");
    expect(h.ctx.selectedRecordId).toBe("cbc-new");
    expect(r2.tone).toBe("success");

    const r3 = await handleUtterance("Explain it in Telugu.", h.deps);
    expect(h.explain).toHaveBeenCalledWith("cbc-new", "te");
    expect(r3.sayLang).toBe("te");
    expect(r3.explanation?.recordId).toBe("cbc-new");
  });

  it("'open my blood test report' with two matches asks which one, then accepts 'second'", async () => {
    const h = harness();
    const r = await handleUtterance("open my blood test report", h.deps);
    expect(r.pending?.kind).toBe("choose");
    expect(h.path).toBe("/dashboard"); // nothing opened yet
    await handleUtterance("the second one", h.deps);
    expect(h.path).toBe("/records/cbc-old");
    expect(h.ctx.pending).toBeUndefined();
  });

  it("Scenario 2: 'latest blood test' opens the newest CBC directly", async () => {
    const h = harness();
    const r = await handleUtterance("Show me my latest blood test report.", h.deps);
    expect(h.path).toBe("/records/cbc-new");
    expect(r.say).toMatch(/latest blood test report/);
  });

  it("explain with nothing selected offers the latest reports", async () => {
    const h = harness({ lang: "hi" });
    const r = await handleUtterance("मेरी मेडिकल रिपोर्ट समझाओ।", h.deps);
    expect(r.pending?.kind).toBe("choose");
    expect(r.say).toContain("मैं आपकी रिपोर्ट आसान भाषा में समझाने में मदद करूँगी");
    const r2 = await handleUtterance("पहला", h.deps);
    expect(h.explain).toHaveBeenCalledWith("cbc-new", "hi");
    expect(r2.explanation).toBeDefined();
  });
});

describe("form update confirmation (Scenario 4)", () => {
  it("asks first, changes nothing until 'yes', then saves and verifies", async () => {
    const h = harness();
    const r1 = await handleUtterance("Change my preferred city to Hyderabad.", h.deps);
    expect(r1.say).toMatch(/Would you like me to set your city to Hyderabad\?/);
    expect(h.prefForm.setField).not.toHaveBeenCalled();
    expect(h.formState.city).toBe("Vijayawada");

    const r2 = await handleUtterance("Yes.", h.deps);
    expect(h.path).toBe("/profile");
    expect(h.prefForm.setField).toHaveBeenCalledWith("city", "Hyderabad");
    expect(h.prefForm.save).toHaveBeenCalledWith("city", "Hyderabad");
    expect(r2.tone).toBe("success");
    expect(h.audits).toContain("VOICE_PREFERENCE_UPDATE");
  });

  it("'no' cancels without changing anything", async () => {
    const h = harness({ lang: "te" });
    await handleUtterance("నా నగరం విశాఖపట్నం కి మార్చు", h.deps);
    const r = await handleUtterance("వద్దు", h.deps);
    expect(r.say).toContain("రద్దు");
    expect(h.prefForm.setField).not.toHaveBeenCalled();
  });

  it("does not claim success when saving fails", async () => {
    const h = harness({ saveImpl: async () => { throw new Error("500"); } });
    await handleUtterance("set my city to Guntur", h.deps);
    const r = await handleUtterance("yes", h.deps);
    expect(r.tone).toBe("error");
    expect(r.say).toMatch(/couldn't save/);
  });

  it("does not claim success when the server returns a different value", async () => {
    const h = harness({ saveImpl: async () => "Delhi" });
    await handleUtterance("set my city to Guntur", h.deps);
    const r = await handleUtterance("yes", h.deps);
    expect(r.tone).toBe("error");
  });

  it("an unrelated reply re-prompts instead of applying", async () => {
    const h = harness();
    await handleUtterance("set my city to Guntur", h.deps);
    const r = await handleUtterance("hmm what", h.deps);
    expect(r.pending?.kind).toBe("confirm");
    expect(h.prefForm.setField).not.toHaveBeenCalled();
  });
});

describe("safety + honesty", () => {
  it("blocks credentials even while a confirmation is pending", async () => {
    const h = harness();
    await handleUtterance("set my city to Guntur", h.deps);
    const r = await handleUtterance("my otp is 123456", h.deps);
    expect(r.intent).toBe("BLOCKED_SENSITIVE");
    expect(h.prefForm.setField).not.toHaveBeenCalled();
  });
  it("reports navigation failure instead of pretending", async () => {
    const h = harness({ navWorks: false });
    const r = await handleUtterance("open my profile", h.deps);
    expect(r.tone).toBe("error");
  });
  it("appointment field without the form open is refused", async () => {
    const h = harness({ path: "/appointments" });
    const r = await handleUtterance("set department to cardiology", h.deps);
    expect(r.intent).not.toBe("UPDATE_FORM_FIELD");
  });
});

describe("language switching", () => {
  it("switches and answers in the new language", async () => {
    const h = harness();
    const r = await handleUtterance("switch to Telugu", h.deps);
    expect(h.lang).toBe("te");
    expect(r.sayLang).toBe("te");
    const r2 = await handleUtterance("నా హెల్త్ రికార్డ్స్ చూపించు", h.deps);
    expect(r2.say).toContain("తప్పకుండా. మీ హెల్త్ రికార్డ్స్ తెరుస్తున్నాను.");
  });
});

describe("resolveRecord", () => {
  it("uses on-screen order for ordinals on the records page", () => {
    const r = resolveRecord({ ordinal: 2 }, RECORDS, { visibleRecordIds: ["bp", "sugar"], onRecordsPage: true });
    expect(r).toMatchObject({ kind: "one", record: { id: "sugar" } });
  });
  it("reportsOnly excludes patient notes", () => {
    const r = resolveRecord({ ordinal: "latest", reportsOnly: true }, [rec("note", "bp_log", "2026-12-01T00:00:00Z", "PATIENT_NOTE"), ...RECORDS], { visibleRecordIds: [], onRecordsPage: false });
    expect(r).toMatchObject({ kind: "one", record: { id: "cbc-new" } });
  });
  it("none when nothing matches", () => {
    expect(resolveRecord({ category: "thyroid" }, RECORDS, { visibleRecordIds: [], onRecordsPage: false }).kind).toBe("none");
  });
});

describe("care-team roles (doctor / ASHA)", () => {
  function careHarness(role: "DOCTOR" | "ASHA", path = "/dashboard") {
    const h = harness({ path });
    let p = path;
    const deps = { ...h.deps, role: () => role, pathname: () => p, navigate: (x: string) => { p = x.split("?")[0]; }, ctx: { visibleRecordIds: [], visiblePatientIds: ["pat-1", "pat-2"] } } as ExecDeps;
    return { deps, get path() { return p; }, explain: h.explain };
  }
  it("'open my patients' navigates to the patient list (Telugu)", async () => {
    const h = careHarness("ASHA");
    await handleUtterance("నా రోగులను చూపించు", { ...h.deps, lang: "te" } as ExecDeps);
    expect(h.path).toBe("/patients");
  });
  it("ASHA can open registration by voice; doctor cannot", async () => {
    const a = careHarness("ASHA");
    await handleUtterance("नया मरीज़ रजिस्टर करो", a.deps);
    expect(a.path).toBe("/patients/register");
    const d = careHarness("DOCTOR");
    const r = await handleUtterance("register a new patient", d.deps);
    expect(d.path).toBe("/patients");
    expect(r.tone).toBe("warning");
  });
  it("'open the second one' on the patient list opens that patient", async () => {
    const h = careHarness("DOCTOR", "/patients");
    await handleUtterance("open the second one", h.deps);
    expect(h.path).toBe("/patients/pat-2");
  });
  it("explains the record open on a care page without navigating to patient-only routes", async () => {
    const h = careHarness("ASHA", "/patients/pat-1/records/rec-9");
    const r = await handleUtterance("దీన్ని తెలుగులో వివరించు", h.deps);
    expect(h.explain).toHaveBeenCalledWith("rec-9", "te");
    expect(h.path).toBe("/patients/pat-1/records/rec-9");
    expect(r.explanation).toBeDefined();
  });
  it("patient-only actions are declined for care roles; patients get a hint for care commands", async () => {
    const h = careHarness("DOCTOR");
    expect((await handleUtterance("show my appointments", h.deps)).tone).toBe("warning");
    const p = harness();
    expect((await handleUtterance("open my patients", p.deps)).intent).toBe("OPEN_PATIENTS");
  });
});
