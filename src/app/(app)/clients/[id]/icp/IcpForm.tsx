"use client";

import { useActionState, useState } from "react";
import type { IcpFormState } from "@/app/actions/icpProfiles";
import type { IcpProfile } from "@/lib/types";

interface Props {
  action: (prev: IcpFormState, formData: FormData) => Promise<IcpFormState>;
  defaults?: Partial<IcpProfile>;
  submitLabel?: string;
}

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
  marginBottom: "6px",
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {hint && <p style={hintStyle}>{hint}</p>}
      {children}
    </div>
  );
}

function ArrayTextarea({ name, defaultValue }: { name: string; defaultValue?: string[] }) {
  return (
    <textarea
      name={name}
      defaultValue={(defaultValue ?? []).join("\n")}
      rows={3}
      style={{ ...inputStyle, resize: "vertical" }}
    />
  );
}

function RulesTextarea({ name, defaultValue }: { name: string; defaultValue?: { field: string; value: string }[] }) {
  const text = (defaultValue ?? []).map((r) => `${r.field}: ${r.value}`).join("\n");
  return (
    <textarea
      name={name}
      defaultValue={text}
      rows={3}
      style={{ ...inputStyle, fontFamily: "monospace", resize: "vertical" }}
      placeholder={"industry: SaaS\nemployees: 50-500"}
    />
  );
}

export default function IcpForm({ action, defaults = {}, submitLabel = "Save" }: Props) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  const dw = defaults.weight_overrides ?? { icp_fit: 40, signal: 35, engagement: 25 };
  const [weights, setWeights] = useState(dw);
  const total = weights.icp_fit + weights.signal + weights.engagement;

  function setW(key: keyof typeof weights, val: number) {
    setWeights((prev) => ({ ...prev, [key]: Math.max(0, Math.min(100, val)) }));
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

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <Field label="ICP name *">
          <input
            name="name"
            defaultValue={defaults.name ?? ""}
            required
            style={inputStyle}
            placeholder="npr. Mid-market SaaS EU"
          />
        </Field>

        <Field
          label="Target description"
          hint="Opiši kakve firme tražiš. AI koristi ovaj opis u qualify kaskadi za poređenje sa homepage-om kompanije."
        >
          <textarea
            name="target_description"
            defaultValue={defaults.target_description ?? ""}
            rows={4}
            style={{ ...inputStyle, resize: "vertical" }}
            placeholder="B2B SaaS kompanije koje prodaju HR ili finance timovima, 50–500 zaposlenih, series A–C..."
          />
        </Field>

        <Field
          label="Anti-target"
          hint="Firme koje NIKAD ne želiš. AI disqualifikuje na osnovu ovoga."
        >
          <textarea
            name="anti_target"
            defaultValue={defaults.anti_target ?? ""}
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
            placeholder="Agencije, freelanceri, firme ispod 10 zaposlenih, recruiting firme..."
          />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
        <Field label="Target roles" hint="One role per line">
          <ArrayTextarea name="target_roles" defaultValue={defaults.target_roles} />
        </Field>
        <Field label="Good fit signals" hint="One signal per line">
          <ArrayTextarea name="good_signals" defaultValue={defaults.good_signals} />
        </Field>
        <Field label="Bad fit signals" hint="One signal per line">
          <ArrayTextarea name="bad_signals" defaultValue={defaults.bad_signals} />
        </Field>
      </div>

      <div>
        <p style={{ fontSize: "14px", fontWeight: 500, color: "#FFFFFF", marginBottom: "12px" }}>
          Scoring weights{" "}
          <span
            style={{
              fontSize: "12px",
              fontWeight: 400,
              color: total === 100 ? "#86EFAC" : "#F87171",
            }}
          >
            (total: {total}/100)
          </span>
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
          {(
            [
              { key: "icp_fit", label: "ICP Fit" },
              { key: "signal", label: "Signal" },
              { key: "engagement", label: "Engagement" },
            ] as const
          ).map(({ key, label }) => (
            <div key={key}>
              <label style={labelStyle}>{label}</label>
              <input
                name={`w_${key}`}
                type="number"
                min={0}
                max={100}
                value={weights[key]}
                onChange={(e) => setW(key, Number(e.target.value))}
                style={inputStyle}
              />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <Field
          label="Must-have rules"
          hint={"Format: field: value (one per line)\nExample: industry: SaaS"}
        >
          <RulesTextarea name="must_have" defaultValue={defaults.must_have} />
        </Field>
        <Field
          label="Must-not rules"
          hint={"Format: field: value (one per line)\nExample: type: agency"}
        >
          <RulesTextarea name="must_not" defaultValue={defaults.must_not} />
        </Field>
      </div>

      <div>
        <button
          type="submit"
          disabled={pending || total !== 100}
          style={{
            backgroundColor: "#FFCC00",
            color: "#272727",
            fontWeight: 600,
            borderRadius: "12px",
            padding: "10px 20px",
            fontSize: "14px",
            border: "none",
            cursor: pending || total !== 100 ? "not-allowed" : "pointer",
            opacity: pending || total !== 100 ? 0.6 : 1,
          }}
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
