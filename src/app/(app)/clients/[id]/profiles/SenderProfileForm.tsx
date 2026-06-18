"use client";

import { useActionState } from "react";
import type { SenderProfileFormState } from "@/app/actions/senderProfiles";

interface Defaults {
  full_name?: string;
  linkedin_url?: string | null;
  heyreach_account_id?: string | null;
  daily_limit?: number;
  notes?: string | null;
}

interface Props {
  action: (
    prev: SenderProfileFormState,
    formData: FormData
  ) => Promise<SenderProfileFormState>;
  defaults?: Defaults;
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
  marginTop: "4px",
};

export default function SenderProfileForm({
  action,
  defaults = {},
  submitLabel = "Save",
}: Props) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
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

      <div>
        <label style={labelStyle}>
          Full name <span style={{ color: "#F87171" }}>*</span>
        </label>
        <input
          name="full_name"
          defaultValue={defaults.full_name ?? ""}
          required
          style={inputStyle}
          placeholder="Marko Marković"
        />
      </div>

      <div>
        <label style={labelStyle}>LinkedIn URL</label>
        <input
          name="linkedin_url"
          defaultValue={defaults.linkedin_url ?? ""}
          style={inputStyle}
          placeholder="https://linkedin.com/in/..."
        />
      </div>

      <div>
        <label style={labelStyle}>HeyReach Account ID</label>
        <input
          name="heyreach_account_id"
          defaultValue={defaults.heyreach_account_id ?? ""}
          style={{ ...inputStyle, fontFamily: "monospace" }}
          placeholder="ID iz HeyReach Settings → LinkedIn Accounts"
        />
        <p style={hintStyle}>HeyReach → Settings → LinkedIn Accounts → copy ID next to account</p>
      </div>

      <div>
        <label style={labelStyle}>Daily connection limit</label>
        <input
          name="daily_limit"
          type="number"
          min={1}
          max={100}
          defaultValue={defaults.daily_limit ?? 20}
          style={inputStyle}
        />
        <p style={hintStyle}>Recommended: 15–25 daily to avoid restrictions</p>
      </div>

      <div>
        <label style={labelStyle}>Notes</label>
        <textarea
          name="notes"
          defaultValue={defaults.notes ?? ""}
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
          placeholder="e.g. this profile targets DACH region..."
        />
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
