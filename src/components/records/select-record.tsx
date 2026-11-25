"use client";
import { useEffect } from "react";
import { useAssistant } from "@/lib/voice/store";

/** Opening a record by mouse also updates the assistant's conversational context. */
export function SelectRecord({ id }: { id: string }) {
  const setCtx = useAssistant((s) => s.setCtx);
  useEffect(() => setCtx({ selectedRecordId: id }), [id, setCtx]);
  return null;
}
