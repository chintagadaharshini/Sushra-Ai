// Lets the assistant operate real React forms without reaching into the DOM.
// A form registers itself while mounted; the assistant can only touch the
// whitelisted fields the form exposes, and only after user confirmation.
import type { FormField } from "./intents";

export type FormId = "preferences" | "appointment-request";

export interface FormBridge {
  id: FormId;
  fields: readonly FormField[];
  /** Current value, formatted for display */
  getDisplay(field: FormField): string | undefined;
  /** Update React form state (and highlight the field) */
  setField(field: FormField, value: string | boolean): void;
  /**
   * Persist a single permitted field. Must resolve with the server-confirmed
   * value, or reject. Forms that require a human to submit omit this.
   */
  save?: (field: FormField, value: string | boolean) => Promise<string | boolean>;
}

const registry = new Map<FormId, FormBridge>();

export const formRegistry = {
  register(bridge: FormBridge) {
    registry.set(bridge.id, bridge);
    return () => {
      if (registry.get(bridge.id) === bridge) registry.delete(bridge.id);
    };
  },
  get(id: FormId) {
    return registry.get(id);
  },
  ids() {
    return [...registry.keys()];
  },
};
