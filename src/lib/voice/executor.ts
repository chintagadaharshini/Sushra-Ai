// Turns an utterance into a verified application action.
// capture → text → intent → params → validate → (confirm) → execute → verify → respond
// All side effects go through `deps`, which keeps this module framework-free and testable.
import { CITY_IDS, DEPARTMENTS, cityName, containsSensitive, formatDate, type Lang, type RecordSummaryDTO, type Role } from "../domain";
import type { Explanation } from "../explain";
import { intentSchema, parseChoice, parseConfirmation, recognize, type FormField, type Intent, type RecordCategory } from "./intents";
import { CATEGORY_LABELS, DIR_WORDS, EDGE_WORDS, FIELD_LABELS, VALUE_LABELS, pageHelp, t } from "./responses";
import type { FormBridge, FormId } from "./form-bridge";
import type { ChoiceOption, ConversationContext, Pending, PendingChoice, PendingConfirm } from "./store";

export interface ExecDeps {
  lang: Lang;
  /** Signed-in role; defaults to PATIENT. */
  role?(): Role;
  ctx: ConversationContext;
  setCtx(patch: Partial<ConversationContext>): void;
  setLang(l: Lang): void;
  pathname(): string;
  navigate(path: string): void;
  back(): void;
  waitFor(pred: () => boolean, timeoutMs?: number): Promise<boolean>;
  scroll(direction: "up" | "down" | "top" | "bottom"): "moved" | "at-top" | "at-bottom";
  forms: { get(id: FormId): FormBridge | undefined };
  facilityResult(): { key: string; count: number; at: number } | undefined;
  api: {
    listRecords(): Promise<RecordSummaryDTO[]>;
    explain(recordId: string, lang: Lang): Promise<Explanation>;
    audit(action: string, outcome: "SUCCESS" | "DENIED" | "FAILED", entityId?: string): void;
    /** Optional LLM fallback: proposes an intent for utterances the deterministic router can't map. */
    interpret?(text: string, lang: Lang): Promise<Intent | null>;
  };
  onExplanation?(e: Explanation): void;
  now?(): number;
}

export interface TurnResult {
  say: string;
  sayLang: Lang;
  tone?: "normal" | "error" | "warning" | "success";
  intent?: Intent["type"];
  explanation?: Explanation;
  pending?: Pending;
}

const ok = (say: string, sayLang: Lang, extra: Partial<TurnResult> = {}): TurnResult => ({ say, sayLang, tone: "normal", ...extra });

function activeForm(deps: ExecDeps): FormId | null {
  const p = deps.pathname();
  if (p.startsWith("/appointments") && deps.forms.get("appointment-request")) return "appointment-request";
  if (p.startsWith("/profile")) return "preferences";
  return null;
}

function recordIdFromPath(p: string): string | undefined {
  const m = p.match(/^\/records\/([^/?#]+)/) ?? p.match(/^\/patients\/[^/?#]+\/records\/([^/?#]+)/);
  return m?.[1];
}

const roleOf = (deps: ExecDeps): Role => deps.role?.() ?? "PATIENT";

async function go(deps: ExecDeps, path: string, matchPrefix = path.split("?")[0]): Promise<boolean> {
  if (deps.pathname() === matchPrefix && !path.includes("?")) return true;
  deps.navigate(path);
  return deps.waitFor(() => deps.pathname() === matchPrefix, 6000);
}

// ---------------------------------------------------------------------------
export async function handleUtterance(text: string, deps: ExecDeps): Promise<TurnResult> {
  const lang = deps.lang;
  const trimmed = text.trim();
  if (!trimmed) return ok(t(lang, "unknown"), lang, { tone: "warning" });

  if (containsSensitive(trimmed)) {
    deps.api.audit("SENSITIVE_INPUT_BLOCKED", "DENIED");
    return ok(t(lang, "blockedSensitive"), lang, { tone: "warning", intent: "BLOCKED_SENSITIVE" });
  }

  const pending = deps.ctx.pending;
  let droppedPending = false;

  if (pending?.kind === "confirm") {
    const c = parseConfirmation(trimmed);
    if (c === "yes") {
      deps.setCtx({ pending: undefined });
      return applyConfirmedField(pending, deps);
    }
    if (c === "no" || recognize(trimmed).type === "CANCEL_ACTION") {
      deps.setCtx({ pending: undefined });
      deps.api.audit("FORM_UPDATE_DECLINED", "DENIED");
      return ok(t(lang, "cancelled"), lang, { intent: "CANCEL_ACTION" });
    }
    droppedPending = true;
  } else if (pending?.kind === "choose") {
    const idx = parseChoice(trimmed, pending.options.length);
    if (idx !== null) {
      deps.setCtx({ pending: undefined });
      return resolveChoice(pending, idx, deps);
    }
    if (recognize(trimmed).type === "CANCEL_ACTION") {
      deps.setCtx({ pending: undefined });
      return ok(t(lang, "cancelled"), lang, { intent: "CANCEL_ACTION" });
    }
    droppedPending = true;
  }

  const path = deps.pathname();
  let intent = recognize(trimmed, {
    hasVisiblePatients: path === "/patients" && (deps.ctx.visiblePatientIds?.length ?? 0) > 0,
    hasVisibleRecords: path === "/records" && deps.ctx.visibleRecordIds.length > 0,
    hasSelectedRecord: Boolean(deps.ctx.selectedRecordId || recordIdFromPath(path)),
    activeForm: activeForm(deps),
  });

  if (intent.type === "UNKNOWN" && deps.api.interpret) {
    // The proposal is schema-validated and then runs through the same guarded executor
    // (confirmations, whitelists and verification still apply).
    const proposed = await deps.api.interpret(trimmed, lang).catch(() => null);
    const valid = proposed ? intentSchema.safeParse(proposed) : null;
    if (valid?.success && valid.data.type !== "BLOCKED_SENSITIVE") intent = valid.data;
  }

  if (droppedPending) {
    if (intent.type === "UNKNOWN") {
      // Still waiting — re-prompt rather than silently losing the pending action.
      const msg = pending!.kind === "confirm" ? t(lang, "sayYesNo") : t(lang, "choiceNotUnderstood");
      return ok(msg, lang, { tone: "warning", pending });
    }
    deps.setCtx({ pending: undefined });
  }

  const result = await executeIntent(intent, deps);
  if (droppedPending && intent.type !== "CANCEL_ACTION") result.say = `${t(lang, "pendingDropped")} ${result.say}`;
  return result;
}

// ---------------------------------------------------------------------------
export async function executeIntent(intent: Intent, deps: ExecDeps): Promise<TurnResult> {
  const lang = deps.lang;
  const p = intent.params ?? {};
  const base = { intent: intent.type } as const;
  const role = roleOf(deps);

  // Care-team roles work with *other people's* records, reached through their patient list.
  if (role !== "PATIENT") {
    const care = await executeCareIntent(intent, deps);
    if (care) return care;
  } else if (intent.type === "OPEN_PATIENTS") {
    return ok(t(lang, "notForPatients"), lang, { ...base, tone: "warning" });
  }

  switch (intent.type) {
    case "BLOCKED_SENSITIVE":
      deps.api.audit("SENSITIVE_INPUT_BLOCKED", "DENIED");
      return ok(t(lang, "blockedSensitive"), lang, { ...base, tone: "warning" });

    case "CANCEL_ACTION":
      if (deps.ctx.pending) {
        deps.setCtx({ pending: undefined });
        return ok(t(lang, "cancelled"), lang, base);
      }
      return ok(t(lang, "nothingToCancel"), lang, base);

    case "NAVIGATE_DASHBOARD":
      return (await go(deps, "/dashboard")) ? ok(t(lang, "openingDashboard"), lang, base) : ok(t(lang, "navFailed"), lang, { ...base, tone: "error" });

    case "OPEN_PROFILE":
      return (await go(deps, "/profile")) ? ok(t(lang, "openingProfile"), lang, base) : ok(t(lang, "navFailed"), lang, { ...base, tone: "error" });

    case "OPEN_HEALTH_RECORDS": {
      const before = deps.ctx.visibleRecordIds;
      const wasOnRecords = deps.pathname() === "/records";
      if (!(await go(deps, "/records"))) return ok(t(lang, "navFailed"), lang, { ...base, tone: "error" });
      if (!wasOnRecords) await deps.waitFor(() => deps.ctx.visibleRecordIds.length > 0 && deps.ctx.visibleRecordIds !== before, 4000);
      const n = deps.ctx.visibleRecordIds.length;
      deps.api.audit("VOICE_OPEN_RECORDS", "SUCCESS");
      return ok(`${t(lang, "openingRecords")}${n ? " " + t(lang, "recordsShown", { n }) : ""}`, lang, base);
    }

    case "OPEN_APPOINTMENTS": {
      const target = p.booking ? "/appointments?new=1" : "/appointments";
      if (!(await go(deps, target, "/appointments"))) return ok(t(lang, "navFailed"), lang, { ...base, tone: "error" });
      if (p.booking) {
        const formReady = await deps.waitFor(() => Boolean(deps.forms.get("appointment-request")), 4000);
        if (!formReady) return ok(t(lang, "navFailed"), lang, { ...base, tone: "error" });
        return ok(t(lang, "openingBooking"), lang, base);
      }
      return ok(t(lang, "openingAppointments"), lang, base);
    }

    case "SEARCH_FACILITIES": {
      const qs = new URLSearchParams();
      if (p.city) qs.set("city", p.city);
      if (p.facilityType) qs.set("type", p.facilityType);
      const key = `${p.city ?? ""}|${p.facilityType ?? ""}`;
      const started = deps.now?.() ?? Date.now();
      deps.navigate(`/facilities${qs.toString() ? `?${qs}` : ""}`);
      const verified = await deps.waitFor(() => {
        const r = deps.facilityResult();
        return deps.pathname() === "/facilities" && !!r && r.key === key && r.at >= started;
      }, 6000);
      if (!verified) return ok(t(lang, "navFailed"), lang, { ...base, tone: "error" });
      const r = deps.facilityResult()!;
      const where = p.city ? whereText(p.city, lang) : "";
      const head = p.city ? t(lang, "openingFacilitiesCity", { city: cityName(p.city, lang) }) : t(lang, "openingFacilities");
      const tail = r.count > 0 ? t(lang, "facilitiesFound", { n: r.count, where }) : t(lang, "facilitiesNone", { where });
      deps.api.audit("VOICE_FACILITY_SEARCH", "SUCCESS");
      return ok(`${head} ${tail}`, lang, { ...base, tone: r.count > 0 ? "normal" : "warning" });
    }

    case "SHOW_HELP":
      if (p.openHelpPage) return (await go(deps, "/help")) ? ok(t(lang, "openingHelp"), lang, base) : ok(t(lang, "navFailed"), lang, { ...base, tone: "error" });
      return ok(pageHelp(deps.pathname(), lang), lang, base);

    case "SCROLL_PAGE": {
      const dir = p.direction ?? "down";
      const res = deps.scroll(dir);
      if (res === "moved") return ok(t(lang, "scrolled", { dir: DIR_WORDS[dir][lang] }), lang, base);
      return ok(t(lang, "scrollLimit", { edge: EDGE_WORDS[res === "at-top" ? "top" : "bottom"][lang] }), lang, base);
    }

    case "GO_BACK":
      deps.back();
      return ok(t(lang, "goingBack"), lang, base);

    case "CHANGE_LANGUAGE": {
      const target = p.targetLang ?? lang;
      deps.setLang(target);
      return ok(t(target, "languageChanged"), target, base);
    }

    case "UPDATE_FORM_FIELD":
      return proposeFieldChange(intent, deps);

    case "OPEN_SPECIFIC_REPORT":
    case "EXPLAIN_REPORT":
      return handleRecordIntent(intent, deps);

    case "UNKNOWN":
    default:
      return ok(t(lang, "unknown"), lang, { ...base, tone: "warning" });
  }
}

/** Doctor / ASHA handling. Returns null for intents that work the same for every role. */
async function executeCareIntent(intent: Intent, deps: ExecDeps): Promise<TurnResult | null> {
  const lang = deps.lang;
  const p = intent.params ?? {};
  const base = { intent: intent.type } as const;
  const role = roleOf(deps);
  const path = deps.pathname();
  switch (intent.type) {
    case "OPEN_HEALTH_RECORDS":
    case "OPEN_PATIENTS": {
      if (p.register) {
        if (role !== "ASHA") {
          await go(deps, "/patients");
          return ok(t(lang, "onlyAshaRegisters"), lang, { ...base, tone: "warning" });
        }
        return (await go(deps, "/patients/register")) ? ok(t(lang, "openingRegisterPatient"), lang, base) : ok(t(lang, "navFailed"), lang, { ...base, tone: "error" });
      }
      const ids = deps.ctx.visiblePatientIds ?? [];
      if (path === "/patients" && typeof p.ordinal === "number" && ids[p.ordinal - 1]) {
        const target = `/patients/${ids[p.ordinal - 1]}`;
        return (await go(deps, target)) ? ok(t(lang, "openingPatient", { name: `#${p.ordinal}` }), lang, { ...base, tone: "success" }) : ok(t(lang, "navFailed"), lang, { ...base, tone: "error" });
      }
      return (await go(deps, "/patients")) ? ok(t(lang, "openingPatients"), lang, base) : ok(t(lang, "navFailed"), lang, { ...base, tone: "error" });
    }
    case "OPEN_SPECIFIC_REPORT": {
      const ids = deps.ctx.visiblePatientIds ?? [];
      if (path === "/patients" && typeof p.ordinal === "number" && ids[p.ordinal - 1]) {
        return (await go(deps, `/patients/${ids[p.ordinal - 1]}`)) ? ok(t(lang, "openingPatient", { name: `#${p.ordinal}` }), lang, { ...base, tone: "success" }) : ok(t(lang, "navFailed"), lang, { ...base, tone: "error" });
      }
      return ok(t(lang, "careOpenRecordFirst"), lang, { ...base, tone: "warning" });
    }
    case "EXPLAIN_REPORT": {
      const current = recordIdFromPath(path);
      if (!current) return ok(t(lang, "careOpenRecordFirst"), lang, { ...base, tone: "warning" });
      return explainRecordFlow(current, p.targetLang ?? lang, deps);
    }
    case "OPEN_APPOINTMENTS":
      return ok(t(lang, "careNotAvailable"), lang, { ...base, tone: "warning" });
    case "UPDATE_FORM_FIELD":
      if (p.field === "department" || p.field === "preferredDate") return ok(t(lang, "careNotAvailable"), lang, { ...base, tone: "warning" });
      return null;
    default:
      return null;
  }
}

function whereText(city: string, lang: Lang) {
  const name = cityName(city, lang);
  if (lang === "en") return ` in ${name}`;
  if (lang === "hi") return `${name} में`;
  return `${name}లో`;
}

// ---------------------------------------------------------------------------
// Records: resolution, disambiguation, open, explain
// ---------------------------------------------------------------------------
export type Resolution = { kind: "one"; record: RecordSummaryDTO } | { kind: "many"; records: RecordSummaryDTO[] } | { kind: "none" };

export function resolveRecord(
  params: Intent["params"],
  all: RecordSummaryDTO[],
  ctx: { visibleRecordIds: string[]; onRecordsPage: boolean },
): Resolution {
  const byDateDesc = (a: RecordSummaryDTO, b: RecordSummaryDTO) => +new Date(b.recordDate) - +new Date(a.recordDate);
  let list = [...all].sort(byDateDesc);
  if (params.category) list = list.filter((r) => r.category === params.category);
  else if (params.reportsOnly) list = list.filter((r) => r.recordType === "LAB_REPORT" || r.recordType === "IMAGING");
  else if (ctx.onRecordsPage && ctx.visibleRecordIds.length) {
    const byId = new Map(all.map((r) => [r.id, r]));
    list = ctx.visibleRecordIds.map((id) => byId.get(id)).filter((r): r is RecordSummaryDTO => Boolean(r));
  }
  if (!list.length) return { kind: "none" };
  if (params.ordinal === "latest") return { kind: "one", record: [...list].sort(byDateDesc)[0] };
  if (params.ordinal === "oldest") return { kind: "one", record: [...list].sort(byDateDesc)[list.length - 1] };
  if (typeof params.ordinal === "number") {
    const r = list[params.ordinal - 1];
    return r ? { kind: "one", record: r } : { kind: "none" };
  }
  if (list.length === 1) return { kind: "one", record: list[0] };
  return { kind: "many", records: list.slice(0, 5) };
}

function toOptions(records: RecordSummaryDTO[], lang: Lang): ChoiceOption[] {
  return records.map((r) => ({ id: r.id, label: r.title, sublabel: `${formatDate(r.recordDate, lang)} · ${r.facilityName}` }));
}

async function handleRecordIntent(intent: Intent, deps: ExecDeps): Promise<TurnResult> {
  const lang = deps.lang;
  const p = intent.params ?? {};
  const isExplain = intent.type === "EXPLAIN_REPORT";
  const explainLang: Lang = p.targetLang ?? lang;
  const path = deps.pathname();

  // "explain it" / "explain this" → the record on screen, else the last selected one
  if (isExplain && !p.category && p.ordinal === undefined) {
    const current = recordIdFromPath(path) ?? deps.ctx.selectedRecordId;
    if (current) return explainRecordFlow(current, explainLang, deps);
  }
  if (!isExplain && p.anaphora && !p.category && p.ordinal === undefined) {
    const current = recordIdFromPath(path) ?? deps.ctx.selectedRecordId;
    if (current) return openRecord(current, undefined, deps);
  }

  let records: RecordSummaryDTO[];
  try {
    records = await deps.api.listRecords();
  } catch (e) {
    return ok(t(lang, (e as Error).message === "UNAUTHENTICATED" ? "sessionExpired" : "networkError"), lang, { intent: intent.type, tone: "error" });
  }

  // Nothing specified for "explain" and nothing selected → offer the latest reports.
  if (isExplain && !p.category && p.ordinal === undefined) {
    const reports = records.filter((r) => r.recordType === "LAB_REPORT" || r.recordType === "IMAGING").slice(0, 3);
    if (!reports.length) return ok(t(lang, "noRecordMatch"), lang, { intent: intent.type, tone: "warning" });
    const pending: PendingChoice = { kind: "choose", purpose: "explain", options: toOptions(reports, lang), explainLang };
    deps.setCtx({ pending });
    return ok(`${t(explainLang, "explainIntro")} ${t(lang, "explainWhich")}`, lang, { intent: intent.type, pending });
  }

  const res = resolveRecord(p, records, { visibleRecordIds: deps.ctx.visibleRecordIds, onRecordsPage: path === "/records" });
  if (res.kind === "none") return ok(t(lang, "noRecordMatch"), lang, { intent: intent.type, tone: "warning" });
  if (res.kind === "many") {
    const pending: PendingChoice = { kind: "choose", purpose: isExplain ? "explain" : "open", options: toOptions(res.records, lang), explainLang };
    deps.setCtx({ pending });
    return ok(t(lang, "chooseRecord", { n: res.records.length }), lang, { intent: intent.type, pending });
  }
  if (isExplain) return explainRecordFlow(res.record.id, explainLang, deps);
  return openRecord(res.record.id, res.record, deps, p.ordinal === "latest");
}

async function resolveChoice(pending: PendingChoice, idx: number, deps: ExecDeps): Promise<TurnResult> {
  const opt = pending.options[idx];
  if (pending.purpose === "explain") return explainRecordFlow(opt.id, pending.explainLang ?? deps.lang, deps);
  return openRecord(opt.id, undefined, deps);
}

async function openRecord(id: string, known: RecordSummaryDTO | undefined, deps: ExecDeps, latest = false): Promise<TurnResult> {
  const lang = deps.lang;
  let rec = known;
  if (!rec) {
    try {
      rec = (await deps.api.listRecords()).find((r) => r.id === id);
    } catch {
      return ok(t(lang, "networkError"), lang, { intent: "OPEN_SPECIFIC_REPORT", tone: "error" });
    }
  }
  if (!rec) return ok(t(lang, "noRecordMatch"), lang, { intent: "OPEN_SPECIFIC_REPORT", tone: "warning" });
  if (!(await go(deps, `/records/${id}`))) return ok(t(lang, "navFailed"), lang, { intent: "OPEN_SPECIFIC_REPORT", tone: "error" });
  deps.setCtx({ selectedRecordId: id });
  deps.api.audit("VOICE_OPEN_RECORD", "SUCCESS", id);
  const label = CATEGORY_LABELS[rec.category as RecordCategory]?.[lang] ?? rec.title;
  const date = formatDate(rec.recordDate, lang);
  return ok(t(lang, latest ? "openingReportLatest" : "openingReport", { label, date }), lang, { intent: "OPEN_SPECIFIC_REPORT", tone: "success" });
}

async function explainRecordFlow(id: string, explainLang: Lang, deps: ExecDeps): Promise<TurnResult> {
  if (recordIdFromPath(deps.pathname()) !== id) {
    if (!(await go(deps, `/records/${id}`))) return ok(t(deps.lang, "navFailed"), deps.lang, { intent: "EXPLAIN_REPORT", tone: "error" });
  }
  deps.setCtx({ selectedRecordId: id });
  try {
    const explanation = await deps.api.explain(id, explainLang);
    deps.onExplanation?.(explanation);
    deps.api.audit("VOICE_EXPLAIN_RECORD", "SUCCESS", id);
    return ok(`${t(explainLang, "explainIntro")} ${explanation.spoken}`, explainLang, { intent: "EXPLAIN_REPORT", explanation, tone: "success" });
  } catch {
    deps.api.audit("VOICE_EXPLAIN_RECORD", "FAILED", id);
    return ok(t(explainLang, "explainFailed"), explainLang, { intent: "EXPLAIN_REPORT", tone: "error" });
  }
}

// ---------------------------------------------------------------------------
// Form filling (always confirmed)
// ---------------------------------------------------------------------------
const FIELD_FORM: Record<FormField, FormId> = {
  city: "preferences",
  preferredLanguage: "preferences",
  textScale: "preferences",
  voiceResponses: "preferences",
  department: "appointment-request",
  preferredDate: "appointment-request",
};

export function displayValue(field: FormField, value: string | boolean, lang: Lang): string {
  if (field === "city") return cityName(String(value), lang);
  if (field === "preferredDate") return formatDate(String(value), lang);
  if (field === "department") return String(value);
  return VALUE_LABELS[String(value)]?.[lang] ?? String(value);
}

function validFieldValue(field: FormField, value: unknown): boolean {
  switch (field) {
    case "city":
      return (CITY_IDS as readonly string[]).includes(String(value));
    case "preferredLanguage":
      return ["en", "hi", "te"].includes(String(value));
    case "textScale":
      return ["normal", "large", "xlarge"].includes(String(value));
    case "voiceResponses":
      return typeof value === "boolean";
    case "department":
      return (DEPARTMENTS as readonly string[]).includes(String(value));
    case "preferredDate":
      return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
  }
}

function proposeFieldChange(intent: Intent, deps: ExecDeps): TurnResult {
  const lang = deps.lang;
  const { field, value } = intent.params ?? {};
  if (!field || value === undefined || !validFieldValue(field, value)) return ok(t(lang, "unknown"), lang, { intent: intent.type, tone: "warning" });
  const formId = FIELD_FORM[field];
  if (formId === "appointment-request" && !deps.forms.get("appointment-request")) {
    return ok(t(lang, "formNotAvailable"), lang, { intent: intent.type, tone: "warning" });
  }
  const pending: PendingConfirm = {
    kind: "confirm",
    formId,
    field,
    value,
    displayField: FIELD_LABELS[field][lang],
    displayValue: displayValue(field, value, lang),
    previousDisplay: deps.forms.get(formId)?.getDisplay(field),
  };
  deps.setCtx({ pending });
  return ok(`${t(lang, "confirmField", { field: pending.displayField, value: pending.displayValue })} ${t(lang, "sayYesNo")}`, lang, {
    intent: intent.type,
    pending,
  });
}

export async function applyConfirmedField(pending: PendingConfirm, deps: ExecDeps): Promise<TurnResult> {
  const lang = deps.lang;
  const vars = { field: pending.displayField, value: pending.displayValue };
  if (pending.formId === "preferences" && !deps.pathname().startsWith("/profile")) {
    deps.navigate("/profile");
  }
  const ready = await deps.waitFor(() => Boolean(deps.forms.get(pending.formId)), 6000);
  const form = deps.forms.get(pending.formId);
  if (!ready || !form) return ok(t(lang, "navFailed"), lang, { intent: "UPDATE_FORM_FIELD", tone: "error" });

  form.setField(pending.field, pending.value);
  if (!form.save) {
    // Human must review and submit (e.g. appointment requests)
    deps.api.audit("VOICE_FORM_FILL", "SUCCESS");
    return ok(t(lang, "fieldFilled", vars), lang, { intent: "UPDATE_FORM_FIELD", tone: "success" });
  }
  try {
    const saved = await form.save(pending.field, pending.value);
    if (saved !== pending.value) throw new Error("verification mismatch");
    deps.api.audit("VOICE_PREFERENCE_UPDATE", "SUCCESS");
    return ok(t(lang, "fieldSaved", vars), lang, { intent: "UPDATE_FORM_FIELD", tone: "success" });
  } catch {
    deps.api.audit("VOICE_PREFERENCE_UPDATE", "FAILED");
    return ok(t(lang, "updateFailed"), lang, { intent: "UPDATE_FORM_FIELD", tone: "error" });
  }
}
