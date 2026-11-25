import { json, withAuth } from "@/server/http";
import { integrationStatus } from "@/server/abdm";
import { llmConfigured } from "@/server/llm";

export const GET = withAuth(async () => json({ ...integrationStatus(), llmConfigured: llmConfigured() }));
