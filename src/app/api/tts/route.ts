import { z } from "zod";
import { withAuth } from "@/server/http";
import { forwardToAgent } from "@/server/voice-agent";
import { LANGS } from "@/lib/domain";

// Natural Telugu/Hindi/English speech via Sarvam Bulbul (key stays in the voice-agent service).
const schema = z.object({ text: z.string().min(1).max(3000), lang: z.enum(LANGS) }).strict();

export const POST = withAuth(async (req) => {
  const body = schema.parse(await req.json());
  return forwardToAgent("/tts", { method: "POST", body: JSON.stringify(body), timeoutMs: 30000 });
});
