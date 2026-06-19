"use client";

import { useRef, useState, useTransition, useEffect } from "react";

interface Batch {
  batch_id: string;
  batch_name: string;
  source: string;
  sender_profile_id: string | null;
  sender_profile_name: string | null;
  uploaded_at: string;
  count: number;
}

interface SenderProfile {
  id: string;
  name: string;
}

const SOURCE_LABEL: Record<string, string> = {
  lgm: "LGM",
  apollo: "Apollo",
  heyreach: "HeyReach",
  manual: "Manual",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("sr-RS", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ContactedHistorySection({
  clientId,
  senderProfiles,
}: {
  clientId: string;
  senderProfiles: SenderProfile[];
}) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, startUpload] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string>(senderProfiles[0]?.id ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  const total = batches.reduce((s, b) => s + b.count, 0);

  async function fetchBatches() {
    setLoading(true);
    const res = await fetch(`/api/clients/${clientId}/contacted-history`);
    const json = await res.json();
    setBatches(json.batches ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchBatches(); }, [clientId]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!selectedProfile && senderProfiles.length > 0) {
      setError("Izaberi identity (sender) pre uploada.");
      return;
    }
    setError(null);
    setSuccess(null);
    startUpload(async () => {
      const fd = new FormData();
      fd.append("csv_file", f);
      if (selectedProfile) fd.append("sender_profile_id", selectedProfile);
      const res = await fetch(`/api/clients/${clientId}/contacted-history`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Greška."); }
      else {
        const profileName = senderProfiles.find((p) => p.id === selectedProfile)?.name ?? "";
        setSuccess(`Uvezeno ${json.inserted.toLocaleString()} kontakata (${SOURCE_LABEL[json.format] ?? json.format}${profileName ? ` · ${profileName}` : ""}).`);
        await fetchBatches();
        if (!expanded) setExpanded(true);
      }
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  async function deleteBatch(batchId: string) {
    if (!confirm("Obrisati ovaj batch?")) return;
    await fetch(`/api/clients/${clientId}/contacted-history?batchId=${batchId}`, { method: "DELETE" });
    setBatches((prev) => prev.filter((b) => b.batch_id !== batchId));
  }

  const selectStyle: React.CSSProperties = {
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "#FFFFFF",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "8px",
    padding: "7px 10px",
    fontSize: "13px",
    outline: "none",
    cursor: "pointer",
  };

  return (
    <div style={{ marginTop: "40px", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "32px" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "8px" }}>
        <button
          onClick={() => setExpanded((x) => !x)}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", padding: 0 }}
        >
          <span style={{ fontSize: "16px", fontWeight: 700, color: "#FFFFFF" }}>Istorija kontakta</span>
          {total > 0 && (
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#272727", backgroundColor: "#FFCC00", borderRadius: "999px", padding: "1px 8px" }}>
              {total.toLocaleString()}
            </span>
          )}
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", display: "inline-block", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
        </button>

        {/* Identity selector + upload */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {senderProfiles.length > 0 && (
            <select
              value={selectedProfile}
              onChange={(e) => setSelectedProfile(e.target.value)}
              style={selectStyle}
            >
              <option value="">— Izaberi identity —</option>
              {senderProfiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <label style={{
            cursor: uploading ? "not-allowed" : "pointer",
            backgroundColor: uploading ? "rgba(255,255,255,0.06)" : "rgba(255,204,0,0.12)",
            color: "#FFCC00",
            border: "1.5px solid #FFCC00",
            borderRadius: "10px",
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: 600,
            display: "inline-block",
            opacity: uploading ? 0.6 : 1,
            whiteSpace: "nowrap",
          }}>
            {uploading ? "Uploading…" : "↑ Uvezi CSV"}
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={uploading}
              style={{ display: "none" }}
            />
          </label>
        </div>
      </div>

      <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", marginBottom: "6px" }}>
        Podržano: La Growth Machine export, Apollo CSV. Matching po linkedin_url (primarno) i email (fallback).
      </p>

      {/* Feedback */}
      {error && (
        <p style={{ fontSize: "13px", color: "#F87171", marginBottom: "10px", padding: "8px 12px", backgroundColor: "rgba(248,113,113,0.08)", borderRadius: "8px" }}>
          {error}
        </p>
      )}
      {success && (
        <p style={{ fontSize: "13px", color: "#86EFAC", marginBottom: "10px", padding: "8px 12px", backgroundColor: "rgba(134,239,172,0.08)", borderRadius: "8px" }}>
          ✓ {success}
        </p>
      )}

      {/* Batch list */}
      {expanded && (
        <div style={{ marginTop: "12px" }}>
          {loading ? (
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", padding: "16px 0" }}>Učitavanje…</p>
          ) : batches.length === 0 ? (
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.25)", padding: "16px 0" }}>
              Nema uploadovanih batcheva. Uvezi CSV sa kontaktima koji su već bili u kampanji.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {batches.map((b) => (
                <div
                  key={b.batch_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    gap: "12px",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#FFFFFF", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {b.batch_name}
                    </p>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", margin: "2px 0 0", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <span>{SOURCE_LABEL[b.source] ?? b.source}</span>
                      {b.sender_profile_name && <span>· {b.sender_profile_name}</span>}
                      <span>· {fmtDate(b.uploaded_at)}</span>
                    </p>
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#FFCC00", whiteSpace: "nowrap" }}>
                    {b.count.toLocaleString()} kontakata
                  </span>
                  <button
                    onClick={() => deleteBatch(b.batch_id)}
                    style={{
                      background: "none",
                      border: "1px solid rgba(248,113,113,0.3)",
                      borderRadius: "6px",
                      color: "#F87171",
                      fontSize: "11px",
                      cursor: "pointer",
                      padding: "3px 8px",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    Obriši
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
