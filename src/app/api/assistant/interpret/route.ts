import { z } from "zod";
import { json, withAuth } from "@/server/http";
import { LANGS } from "@/lib/domain";
import { llmConfigured, llmProposeIntent } from "@/server/llm";

const schema = z.object({ text: z.string().min(1).max(300), lang: z.enum(LANGS) }).strict();

/** Optional: asks the LLM to PROPOSE an intent for an utterance the deterministic router didn't understand. */
export const POST = withAuth(async (req) => {
  const body = schema.parse(await req.json());
  if (!llmConfigured()) return json({ configured: false, intent: null });
  try {
    const intent = await llmProposeIntent(body.text, body.lang);
    return json({ configured: true, intent });
  } catch {
    return json({ configured: true, intent: null });
  }
});
