import "server-only";
import { prisma } from "./db";

/** Audit log stores WHAT happened — never transcripts, audio or clinical values. */
export async function audit(e: {
  userId: string;
  action: string;
  entity?: string;
  entityId?: string;
  channel?: "UI" | "VOICE";
  outcome?: "SUCCESS" | "DENIED" | "FAILED";
}) {
  try {
    await prisma.auditEvent.create({
      data: { userId: e.userId, action: e.action, entity: e.entity, entityId: e.entityId, channel: e.channel ?? "UI", outcome: e.outcome ?? "SUCCESS" },
    });
  } catch {
    /* audit must never break the main flow */
  }
}

export function channelOf(req: Request): "UI" | "VOICE" {
  return req.headers.get("x-sv-channel") === "VOICE" ? "VOICE" : "UI";
}
