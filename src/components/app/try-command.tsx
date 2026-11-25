"use client";
import { Mic } from "lucide-react";
import { useAssistant } from "@/lib/voice/store";
import { cn } from "@/lib/utils";

/** Sends a real command through the assistant (same pipeline as speech). */
export function TryCommand({ cmd, className, label }: { cmd: string; className?: string; label?: string }) {
  const queue = useAssistant((s) => s.queueCommand);
  return (
    <button
      onClick={() => queue(cmd)}
      className={cn("inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-sm font-semibold text-ink shadow-soft hover:border-brand-300 hover:bg-brand-50 cursor-pointer", className)}
    >
      <Mic className="size-4 text-brand-600" aria-hidden />
      <span>“{label ?? cmd}”</span>
    </button>
  );
}

export function OpenAssistantButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const setOpen = useAssistant((s) => s.setOpen);
  return (
    <button onClick={() => setOpen(true)} className={className}>
      {children}
    </button>
  );
}
