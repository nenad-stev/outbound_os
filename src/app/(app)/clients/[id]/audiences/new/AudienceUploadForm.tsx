"use client";

import { useActionState, useState } from "react";

interface Campaign {
  id: string;
  name: string;
  sender_name: string | null;
}

interface IcpProfile {
  id: string;
  name: string;
  is_default: boolean;
}

interface Props {
  campaigns: Campaign[];
  icpProfiles: IcpProfile[];
  action: (prev: { error: string | null }, formData: FormData) => Promise<{ error: string | null }>;
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

export default function AudienceUploadForm({ campaigns, icpProfiles, action }: Props) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const defaultIcp = icpProfiles.find((i) => i.is_default) ?? icpProfiles[0];

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
          Campaign <span style={{ color: "#F87171" }}>*</span>
        </label>
        <select
          name="campaign_id"
          required
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          <option value="" style={{ backgroundColor: "#3B3B3B" }}>— select campaign —</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id} style={{ backgroundColor: "#3B3B3B" }}>
              {c.name}{c.sender_name ? ` (${c.sender_name})` : ""}
            </option>
          ))}
        </select>
        <p style={hintStyle}>Sender profile is assigned to the campaign.</p>
      </div>

      <div>
        <label style={labelStyle}>
          ICP profile <span style={{ color: "#F87171" }}>*</span>
        </label>
        <select
          name="icp_profile_id"
          required
          defaultValue={defaultIcp?.id ?? ""}
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          <option value="" style={{ backgroundColor: "#3B3B3B" }}>— select ICP —</option>
          {icpProfiles.map((i) => (
            <option key={i.id} value={i.id} style={{ backgroundColor: "#3B3B3B" }}>
              {i.name}{i.is_default ? " (default)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>
          CSV file <span style={{ color: "#F87171" }}>*</span>
        </label>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f) setFile(f);
          }}
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "16px",
            border: dragOver
              ? "2px dashed rgba(255,204,0,0.5)"
              : "2px dashed rgba(255,255,255,0.12)",
            backgroundColor: dragOver ? "rgba(255,204,0,0.05)" : "rgba(255,255,255,0.03)",
            padding: "40px 24px",
            textAlign: "center",
            transition: "all 0.15s",
            cursor: "pointer",
          }}
        >
          <input
            type="file"
            name="csv_file"
            accept=".csv"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0,
              cursor: "pointer",
              width: "100%",
              height: "100%",
            }}
          />
          {file ? (
            <>
              <p style={{ fontSize: "14px", fontWeight: 500, color: "#FFFFFF" }}>{file.name}</p>
              <p style={{ marginTop: "4px", fontSize: "12px", color: "#BDBDBD" }}>
                {(file.size / 1024).toFixed(0)} KB — click to change
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: "14px", color: "#BDBDBD" }}>Drag CSV here or click to upload</p>
              <p style={{ marginTop: "4px", fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
                Apollo or Sales Navigator/LGM format · max 10MB
              </p>
            </>
          )}
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
          {pending ? "Uploading and analyzing…" : "Upload & preview"}
        </button>
      </div>
    </form>
  );
}
