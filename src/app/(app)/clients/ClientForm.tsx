"use client";

import { useActionState } from "react";
import type { ClientFormState } from "@/app/actions/clients";

const initial: ClientFormState = { error: null };

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

export default function ClientForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (
    prev: ClientFormState,
    formData: FormData
  ) => Promise<ClientFormState>;
  defaults?: { name?: string; website?: string | null; notes?: string | null; image_style_guide?: string | null };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "520px" }}>
      <div>
        <label style={labelStyle}>Name</label>
        <input
          name="name"
          required
          defaultValue={defaults?.name ?? ""}
          style={inputStyle}
          placeholder="Acme Corp"
        />
      </div>

      <div>
        <label style={labelStyle}>Website</label>
        <input
          name="website"
          type="url"
          placeholder="https://"
          defaultValue={defaults?.website ?? ""}
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Notes</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaults?.notes ?? ""}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      <div>
        <label style={labelStyle}>Image style guide</label>
        <textarea
          name="image_style_guide"
          rows={4}
          placeholder="Npr. Minimalistički stil, plava #0066CC i bela, bez ljudi, corporate fotografija, čiste linije, profesionalno..."
          defaultValue={defaults?.image_style_guide ?? ""}
          style={{ ...inputStyle, resize: "vertical" }}
        />
        <p style={hintStyle}>Automatski se ubacuje u svaki image prompt za ovog klijenta.</p>
      </div>

      {state.error && (
        <p
          role="alert"
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
