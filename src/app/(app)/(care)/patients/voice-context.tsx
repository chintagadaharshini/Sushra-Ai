"use client";
import { useEffect } from "react";
import { useAssistant } from "@/lib/voice/store";

/** Lets the assistant resolve "open the first one" on the patients list. */
export function CarePatientsVoiceContext({ ids }: { ids: string[] }) {
  const setCtx = useAssistant((s) => s.setCtx);
  useEffect(() => setCtx({ visiblePatientIds: ids }), [ids, setCtx]);
  return null;
}
