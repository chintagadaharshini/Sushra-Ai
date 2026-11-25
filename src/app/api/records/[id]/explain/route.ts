import { z } from "zod";
import { ApiError, json, withAuth } from "@/server/http";
import { getRecordForViewer } from "@/server/care";
import { audit, channelOf } from "@/server/audit";
import { explainRecord } from "@/lib/explain";
import { LANGS } from "@/lib/domain";
import { prisma } from "@/server/db";
import { llmConfigured, llmExplain } from "@/server/llm";

const schema = z.object({ lang: z.enum(LANGS), mode: z.enum(["deterministic", "llm"]).default("deterministic") }).strict();

export const POST = withAuth<{ params: Promise<{ id: string }> }>(async (req, user, { params }) => {
  const { id } = await params;
  const body = schema.parse(await req.json().catch(() => ({})));
  const record = await getRecordForViewer(user, id);
  if (!record) throw new ApiError(404, "Record not found", "NOT_FOUND");

  const explanation = explainRecord(record, body.lang);

  if (body.mode === "llm") {
    if (user.role !== "PATIENT") throw new ApiError(403, "AI wording is available to patients only.", "FORBIDDEN");
    if (!llmConfigured()) throw new ApiError(409, "No AI provider is configured on the server; using the built-in explanation.", "LLM_NOT_CONFIGURED");
    const consent = await prisma.consentRecord.findFirst({ where: { patientId: user.profile!.id, purpose: "AI_REPORT_EXPLANATION", status: "GRANTED" } });
    if (!consent) throw new ApiError(403, "AI explanation needs your consent first (Privacy & Consent page).", "CONSENT_REQUIRED");
    if (record.labResults.length === 0) throw new ApiError(400, "AI explanation is only available for lab reports.", "UNSUPPORTED");
    const text = await llmExplain(record, body.lang);
    await audit({ userId: user.id, action: "AI_EXPLANATION", entity: "HealthRecord", entityId: id, channel: channelOf(req) });
    return json({ explanation: { ...explanation, mode: "llm", summary: text, spoken: `${explanation.intro} ${text}` } });
  }
  await audit({ userId: user.id, action: "RECORD_EXPLAINED", entity: "HealthRecord", entityId: id, channel: channelOf(req) });
  return json({ explanation });
});
