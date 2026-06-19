// Shared sequence-step helpers. Each step maps to ONE HeyReach custom variable
// so the operator references it as {{variableName}} in the HeyReach sequence,
// and we push the per-lead rendered text under that same name.

export interface SeqStep {
  step_order: number;
  channel: string;
  template_text: string;
  delay_days?: number;
}

export interface NamedStep extends SeqStep {
  variableName: string; // HeyReach custom variable name, e.g. "message_1"
  label: string;        // human label, e.g. "Poruka 1"
}

// Connection-request note → connection_note; messages → message_1, message_2…;
// inmails → inmail_1… Order is stable (sorted by step_order).
export function nameSequenceSteps(steps: SeqStep[]): NamedStep[] {
  let msg = 0;
  let inmail = 0;
  return [...steps]
    .sort((a, b) => a.step_order - b.step_order)
    .map((s) => {
      if (s.channel === "connection_request") {
        return { ...s, variableName: "connection_note", label: "Connection request" };
      }
      if (s.channel === "inmail") {
        inmail++;
        return { ...s, variableName: `inmail_${inmail}`, label: `InMail ${inmail}` };
      }
      msg++;
      return { ...s, variableName: `message_${msg}`, label: `Poruka ${msg}` };
    });
}

// Per-lead rendered messages live here, keyed by step_order (as string).
export type RenderedMessages = Record<string, string>;
