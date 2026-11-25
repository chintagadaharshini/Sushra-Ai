"use client";
import { HeartHandshake, Stethoscope, UserRound } from "lucide-react";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/domain";
import { cn } from "@/lib/utils";

const ICON = { PATIENT: UserRound, DOCTOR: Stethoscope, ASHA: HeartHandshake } as const;
const HINT: Record<Role, string> = { PATIENT: "Your records & care", DOCTOR: "Patients who share with you", ASHA: "Community health work" };

export function RoleTabs({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  return (
    <div role="radiogroup" aria-label="I am a" className="grid grid-cols-3 gap-2">
      {ROLES.map((r) => {
        const Icon = ICON[r];
        return (
          <button key={r} type="button" role="radio" aria-checked={value === r} onClick={() => onChange(r)}
            className={cn("flex flex-col items-center gap-1 rounded-2xl border p-3 text-center transition cursor-pointer", value === r ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-brand-300")}>
            <Icon className="size-6" aria-hidden />
            <span className="text-sm font-bold">{ROLE_LABEL[r]}</span>
            <span className={cn("hidden text-[0.7rem] sm:block", value === r ? "text-slate-300" : "text-muted")}>{HINT[r]}</span>
          </button>
        );
      })}
    </div>
  );
}
