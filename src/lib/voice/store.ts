"use client";
// Session-scoped assistant state (in memory only — cleared on reload; nothing is persisted).
import { create } from "zustand";
import type { Lang, Role } from "../domain";
import type { Explanation } from "../explain";
import type { FormField } from "./intents";

export type AssistantStatus = "idle" | "listening" | "processing" | "speaking" | "awaiting-confirmation" | "awaiting-choice";

export interface ChoiceOption {
  id: string;
  label: string;
  sublabel?: string;
}

export interface PendingConfirm {
  kind: "confirm";
  formId: "preferences" | "appointment-request";
  field: FormField;
  value: string | boolean;
  displayField: string;
  displayValue: string;
  previousDisplay?: string;
}
export interface PendingChoice {
  kind: "choose";
  purpose: "open" | "explain";
  options: ChoiceOption[];
  explainLang?: Lang;
}
export type Pending = PendingConfirm | PendingChoice;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  lang: Lang;
  tone?: "normal" | "error" | "warning" | "success";
  explanation?: Explanation;
  pending?: Pending;
  resolved?: boolean;
}

export interface ConversationContext {
  /** Records currently displayed on the records page, in display order. */
  visibleRecordIds: string[];
  /** Patients shown on the care-team list (doctor / ASHA), in display order. */
  visiblePatientIds?: string[];
  /** The record the user most recently opened (UI click or voice). */
  selectedRecordId?: string;
  pending?: Pending;
}

interface AssistantState {
  role: Role;
  setRole(r: Role): void;
  open: boolean;
  status: AssistantStatus;
  lang: Lang;
  voiceOn: boolean;
  interim: string;
  messages: ChatMessage[];
  ctx: ConversationContext;
  pathname: string;
  /** Latest explanation per record, so the record page can show it too. */
  explanations: Record<string, Explanation>;
  /** Published by the facilities page after each search (used to verify voice actions). */
  facilityResult?: { key: string; count: number; at: number };
  /** Published by the records page. */
  recordsListAt?: number;
  /** Fields recently changed by the assistant (for visual highlight). */
  highlightedField?: string;
  /** Commands queued from UI chips/buttons; processed by the assistant engine. */
  queued: { id: number; text: string; display?: string } | null;
  ttsNotice?: string;

  queueCommand(text: string, display?: string): void;
  takeQueued(): { id: number; text: string; display?: string } | null;
  setTtsNotice(n?: string): void;
  setOpen(open: boolean): void;
  setStatus(s: AssistantStatus): void;
  setLang(l: Lang): void;
  setVoiceOn(v: boolean): void;
  setInterim(t: string): void;
  addMessage(m: Omit<ChatMessage, "id">): string;
  resolveMessage(id: string): void;
  setCtx(patch: Partial<ConversationContext>): void;
  setPathname(p: string): void;
  setExplanation(e: Explanation): void;
  setFacilityResult(key: string, count: number): void;
  setRecordsListed(ids: string[]): void;
  setHighlightedField(f?: string): void;
  clearConversation(): void;
}

let counter = 0;
export const useAssistant = create<AssistantState>((set) => ({
  role: "PATIENT",
  setRole: (role) => set({ role }),
  open: false,
  status: "idle",
  lang: "en",
  voiceOn: true,
  interim: "",
  messages: [],
  ctx: { visibleRecordIds: [] },
  pathname: "/",
  explanations: {},
  queued: null,
  queueCommand: (text, display) => set({ queued: { id: Date.now() + counter++, text, display }, open: true }),
  takeQueued: () => {
    let q: { id: number; text: string; display?: string } | null = null;
    set((s) => {
      q = s.queued;
      return { queued: null };
    });
    return q;
  },
  setTtsNotice: (ttsNotice) => set({ ttsNotice }),
  setOpen: (open) => set({ open }),
  setStatus: (status) => set({ status }),
  setLang: (lang) => set({ lang }),
  setVoiceOn: (voiceOn) => set({ voiceOn }),
  setInterim: (interim) => set({ interim }),
  addMessage: (m) => {
    const id = `m${Date.now().toString(36)}${counter++}`;
    set((s) => ({ messages: [...s.messages.slice(-40), { ...m, id }] }));
    return id;
  },
  resolveMessage: (id) => set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, resolved: true } : m)) })),
  setCtx: (patch) => set((s) => ({ ctx: { ...s.ctx, ...patch } })),
  setPathname: (pathname) => set({ pathname }),
  setExplanation: (e) => set((s) => ({ explanations: { ...s.explanations, [e.recordId]: e } })),
  setFacilityResult: (key, count) => set({ facilityResult: { key, count, at: Date.now() } }),
  setRecordsListed: (ids) => set((s) => ({ ctx: { ...s.ctx, visibleRecordIds: ids }, recordsListAt: Date.now() })),
  setHighlightedField: (highlightedField) => set({ highlightedField }),
  clearConversation: () => set({ messages: [], ctx: { visibleRecordIds: [] }, interim: "", explanations: {} }),
}));
