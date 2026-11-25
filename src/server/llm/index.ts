import "server-only";
// Optional LLM support. Server-side only; the API key never reaches the browser.
// The LLM can only (a) PROPOSE a structured intent that is validated with Zod and
// then executed by the deterministic executor, or (b) rephrase a report explanation
// from minimal, de-identified lab values — and only after the user granted consent.
import { z } from "zod";
import { intentSchema, type Intent } from "@/lib/voice/intents";
import type { Lang, RecordDetailDTO } from "@/lib/domain";

export function llmConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

async function callClaude(system: string, user: string, maxTokens = 600): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || "claude-sonnet-5-5",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return data.content?.find((c) => c.type === "text")?.text ?? "";
}

/** Extracts the first JSON object from model output and validates it as an Intent. */
export function parseIntentJson(raw: string): Intent | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const parsed = intentSchema.safeParse(JSON.parse(m[0]));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function llmProposeIntent(text: string, lang: Lang): Promise<Intent | null> {
  const system = `You map a patient's spoken command (English, Hindi or Telugu) for a healthcare app to ONE JSON object.
Return ONLY JSON: {"type": <intent>, "params": {...}}.
Allowed types: NAVIGATE_DASHBOARD, OPEN_HEALTH_RECORDS, OPEN_SPECIFIC_REPORT, EXPLAIN_REPORT, OPEN_PROFILE, UPDATE_FORM_FIELD, SEARCH_FACILITIES, OPEN_APPOINTMENTS, SHOW_HELP, SCROLL_PAGE, GO_BACK, CHANGE_LANGUAGE, CANCEL_ACTION, UNKNOWN.
Allowed params: category (blood_test|diabetes|lipid|thyroid|consultation|prescription|chest_xray|bp_log), ordinal ("latest"|"oldest"|1-20), anaphora (bool), targetLang (en|hi|te), field (city|preferredLanguage|textScale|voiceResponses|department|preferredDate), value, city, facilityType (HOSPITAL|CLINIC|PHC|DIAGNOSTIC_LAB|PHARMACY), booking (bool), direction (up|down|top|bottom), openHelpPage (bool), reportsOnly (bool).
Never output code. If unsure, return {"type":"UNKNOWN","params":{}}.`;
  const out = await callClaude(system, `Language: ${lang}\nCommand: ${text.slice(0, 300)}`, 200);
  return parseIntentJson(out);
}

const llmExplanationSchema = z.object({ text: z.string().min(1).max(4000) });

/** Sends ONLY test names, values, units and lab reference ranges — no name, IDs, facility or dates. */
export async function llmExplain(record: RecordDetailDTO, lang: Lang): Promise<string> {
  const minimal = record.labResults.map((l) => ({ test: l.testName, value: l.value ?? l.valueText, unit: l.unit, refLow: l.refLow, refHigh: l.refHigh, refText: l.refText }));
  const langName = { en: "English", hi: "Hindi", te: "Telugu" }[lang];
  const system = `You explain lab results to an elderly patient in simple ${langName}.
Rules: Use only the values given. State which values are outside the lab's provided reference range. Do NOT diagnose, do NOT suggest medicines or treatment. Mention uncertainty. End by advising them to discuss with a qualified doctor.
Respond as JSON: {"text": "..."}`;
  const out = await callClaude(system, JSON.stringify({ reportType: record.category, results: minimal }), 900);
  const m = out.match(/\{[\s\S]*\}/);
  const parsed = m ? llmExplanationSchema.safeParse(JSON.parse(m[0])) : null;
  if (!parsed?.success) throw new Error("Invalid LLM explanation payload");
  return parsed.data.text;
}
