"use client";

import { useActionState, useState } from "react";
import type { CampaignFormState } from "@/app/actions/campaigns";
import type { Campaign, SequenceStep, SequenceChannel, PersonalizationLevel } from "@/lib/types";

interface StepDraft {
  channel: SequenceChannel;
  template_text: string;
  ai_instructions: string;
  delay_days: number;
}

interface Props {
  action: (prev: CampaignFormState, formData: FormData) => Promise<CampaignFormState>;
  defaults?: Partial<Campaign>;
  defaultSteps?: SequenceStep[];
  parentOptions?: { id: string; name: string }[];
  senderOptions?: { id: string; full_name: string }[];
  submitLabel?: string;
}

const CHANNEL_LABELS: Record<SequenceChannel, string> = {
  connection_request: "Connection request",
  message: "Message",
  inmail: "InMail",
};

const PERSONALIZATION_LABELS: Record<PersonalizationLevel, string> = {
  light: "Light — {ime}/{firma} + male izmene",
  medium: "Medium — AI prilagođava tonu i kontekstu",
  heavy: "Heavy — AI prepisuje po industriji i signalima",
};

const VARIABLES = ["{first_name}", "{company}", "{industry}", "{role}", "{signal}"];

const inputStyle: React.CSSProperties = {
  backgroundColor: "#3B3B3B",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "12px",
  color: "#FFFFFF",
  padding: "10px 14px",
  fontSize: "14px",
  width: "100%",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.35)",
  marginBottom: "6px",
};

const hintStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "rgba(255,255,255,0.35)",
  marginTop: "4px",
};

function StepEditor({
  index,
  step,
  onChange,
  onRemove,
  isFirst,
}: {
  index: number;
  step: StepDraft;
  onChange: (s: StepDraft) => void;
  onRemove: () => void;
  isFirst: boolean;
}) {
  return (
    <div
      style={{
        backgroundColor: "#303030",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "16px",
        padding: "20px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "rgba(255,255,255,0.35)",
          }}
        >
          Step {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          style={{
            backgroundColor: "transparent",
            border: "none",
            color: "rgba(255,255,255,0.35)",
            fontSize: "12px",
            cursor: "pointer",
            padding: "4px 8px",
          }}
        >
          Remove
        </button>
      </div>

      <input type="hidden" name={`step_${index}_text`} value={step.template_text} />
      <input type="hidden" name={`step_${index}_channel`} value={step.channel} />
      <input type="hidden" name={`step_${index}_delay`} value={step.delay_days} />
      <input type="hidden" name={`step_${index}_ai_instructions`} value={step.ai_instructions} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
        <div>
          <label style={labelStyle}>Channel</label>
          <select
            value={step.channel}
            onChange={(e) => onChange({ ...step, channel: e.target.value as SequenceChannel })}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            {Object.entries(CHANNEL_LABELS).map(([v, l]) => (
              <option key={v} value={v} style={{ backgroundColor: "#3B3B3B" }}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>
            {isFirst ? "Send immediately (delay 0)" : "Delay (days)"}
          </label>
          <input
            type="number"
            min={0}
            value={step.delay_days}
            disabled={isFirst}
            onChange={(e) => onChange({ ...step, delay_days: Number(e.target.value) })}
            style={{ ...inputStyle, opacity: isFirst ? 0.5 : 1 }}
          />
        </div>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "8px" }}>
          <div>
            <label style={labelStyle}>Message template</label>
            <p style={hintStyle}>
              Koristi{" "}
              <code style={{ backgroundColor: "rgba(255,255,255,0.08)", padding: "1px 6px", borderRadius: "4px", fontSize: "11px" }}>
                {"{personalization}"}
              </code>{" "}
              gde AI treba da ubaci personalizovanu rečenicu.
            </p>
          </div>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {VARIABLES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onChange({ ...step, template_text: step.template_text + v })}
                style={{
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: "none",
                  color: "#BDBDBD",
                  borderRadius: "6px",
                  padding: "3px 8px",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <textarea
          rows={5}
          value={step.template_text}
          onChange={(e) => onChange({ ...step, template_text: e.target.value })}
          style={{ ...inputStyle, resize: "vertical" }}
          placeholder={
            step.channel === "connection_request"
              ? "Hi {first_name}, {personalization}\n\nWould love to connect."
              : "Hi {first_name},\n\n{personalization}\n\nWould love to chat — are you open to a quick call?"
          }
        />
        {step.channel === "connection_request" && step.template_text.length > 300 && (
          <p style={{ marginTop: "4px", fontSize: "12px", color: "#F87171" }}>
            Connection request note max 300 karaktera ({step.template_text.length}/300)
          </p>
        )}
      </div>

      <div
        style={{
          backgroundColor: "rgba(99,102,241,0.08)",
          border: "1px solid rgba(99,102,241,0.2)",
          borderRadius: "12px",
          padding: "14px",
        }}
      >
        <label
          style={{
            display: "block",
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#A5B4FC",
            marginBottom: "6px",
          }}
        >
          AI instrukcije za personalizaciju
        </label>
        <p style={{ fontSize: "12px", color: "rgba(165,180,252,0.7)", marginBottom: "8px" }}>
          Šta AI treba da napiše na mestu{" "}
          <code style={{ backgroundColor: "rgba(99,102,241,0.2)", padding: "1px 6px", borderRadius: "4px" }}>
            {"{personalization}"}
          </code>{" "}
          — ton, dužina, šta da referenciše.
        </p>
        <textarea
          rows={3}
          value={step.ai_instructions}
          onChange={(e) => onChange({ ...step, ai_instructions: e.target.value })}
          style={{
            backgroundColor: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: "10px",
            color: "#FFFFFF",
            padding: "10px 14px",
            fontSize: "13px",
            width: "100%",
            outline: "none",
            resize: "vertical",
            boxSizing: "border-box",
          }}
          placeholder="Napiši 1 rečenicu (max 20 reči) koja pominje industriju ili veličinu firme. Ton: casual, ne salesy. Ne pominjati naš produkt."
        />
      </div>
    </div>
  );
}

export default function CampaignForm({
  action,
  defaults = {},
  defaultSteps = [],
  parentOptions = [],
  senderOptions = [],
  submitLabel = "Save",
}: Props) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [steps, setSteps] = useState<StepDraft[]>(
    defaultSteps.length > 0
      ? defaultSteps.map((s) => ({
          channel: s.channel,
          template_text: s.template_text,
          ai_instructions: s.ai_instructions ?? "",
          delay_days: s.delay_days,
        }))
      : [{ channel: "connection_request", template_text: "", ai_instructions: "", delay_days: 0 }]
  );

  function addStep() {
    setSteps((prev) => [...prev, { channel: "message", template_text: "", ai_instructions: "", delay_days: 3 }]);
  }

  function updateStep(i: number, s: StepDraft) {
    setSteps((prev) => prev.map((x, idx) => (idx === i ? s : x)));
  }

  function removeStep(i: number) {
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {state.error && (
        <p
          style={{
            backgroundColor: "rgba(239,68,68,0.12)",
            color: "#F87171",
            borderRadius: "12px",
            padding: "10px 14px",
            fontSize: "14px",
          }}
        >
          {state.error}
        </p>
      )}

      <input type="hidden" name="step_count" value={steps.length} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Campaign name *</label>
          <input
            name="name"
            defaultValue={defaults.name ?? ""}
            required
            style={inputStyle}
            placeholder="npr. Initial outreach Q3 2026"
          />
        </div>

        {senderOptions.length > 0 && (
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Sender profile</label>
            <select
              name="sender_profile_id"
              defaultValue={defaults.sender_profile_id ?? ""}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="" style={{ backgroundColor: "#3B3B3B" }}>— nije dodeljen —</option>
              {senderOptions.map((s) => (
                <option key={s.id} value={s.id} style={{ backgroundColor: "#3B3B3B" }}>{s.full_name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label style={labelStyle}>Type</label>
          <select
            name="type"
            defaultValue={defaults.type ?? "initial"}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            <option value="initial" style={{ backgroundColor: "#3B3B3B" }}>Initial</option>
            <option value="follow_up" style={{ backgroundColor: "#3B3B3B" }}>Follow-up</option>
            <option value="ad_hoc" style={{ backgroundColor: "#3B3B3B" }}>Ad-hoc</option>
          </select>
        </div>

        <div>
          <label style={labelStyle}>Personalization</label>
          <select
            name="personalization_level"
            defaultValue={defaults.personalization_level ?? "light"}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            {(Object.entries(PERSONALIZATION_LABELS) as [PersonalizationLevel, string][]).map(
              ([v, l]) => (
                <option key={v} value={v} style={{ backgroundColor: "#3B3B3B" }}>{l}</option>
              )
            )}
          </select>
        </div>

        <div>
          <label style={labelStyle}>HeyReach Campaign ID</label>
          <input
            name="heyreach_campaign_id"
            defaultValue={defaults.heyreach_campaign_id ?? ""}
            style={{ ...inputStyle, fontFamily: "monospace" }}
            placeholder="Opciono — povežeš nakon kreiranja"
          />
        </div>

        <div>
          <label style={labelStyle}>Follow-up delay (days)</label>
          <input
            name="followup_delay_days"
            type="number"
            min={1}
            defaultValue={defaults.followup_delay_days ?? 60}
            style={inputStyle}
          />
          <p style={hintStyle}>Koliko dana bez odgovora pre follow-up</p>
        </div>

        {parentOptions.length > 0 && (
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Parent campaign (za follow-up)</label>
            <select
              name="parent_campaign_id"
              defaultValue={defaults.parent_campaign_id ?? ""}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="" style={{ backgroundColor: "#3B3B3B" }}>— nije follow-up —</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id} style={{ backgroundColor: "#3B3B3B" }}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.35)",
            }}
          >
            Sequence steps ({steps.length})
          </p>
          <button
            type="button"
            onClick={addStep}
            style={{
              backgroundColor: "transparent",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#FFFFFF",
              borderRadius: "10px",
              padding: "6px 14px",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            + Add step
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {steps.map((s, i) => (
            <StepEditor
              key={i}
              index={i}
              step={s}
              isFirst={i === 0}
              onChange={(updated) => updateStep(i, updated)}
              onRemove={() => removeStep(i)}
            />
          ))}
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={pending}
          style={{
            backgroundColor: "#FFCC00",
            color: "#272727",
            fontWeight: 600,
            borderRadius: "12px",
            padding: "10px 20px",
            fontSize: "14px",
            border: "none",
            cursor: pending ? "not-allowed" : "pointer",
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
