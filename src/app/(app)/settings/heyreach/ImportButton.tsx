"use client";

import { useState } from "react";

interface Result {
  fetched: number; people: number; assignments: number; skipped: number;
  errors: number; errors_detail?: string[];
}

export default function ImportButton({ clients }: { clients: { id: string; name: string }[] }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<Result | null>(null);
  const [err,      setErr]      = useState<string | null>(null);

  async function run() {
    if (!clientId) return;
    setLoading(true); setResult(null); setErr(null);
    try {
      const res = await fetch(`/api/heyreach/import/${clientId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) setErr(data.error ?? "Greška");
      else setResult(data);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      backgroundColor: "#303030", border: "1px solid rgba(255,204,0,0.15)",
      borderRadius: "14px", padding: "20px 24px", marginBottom: "32px",
    }}>
      <p style={{ fontSize: "13px", fontWeight: 600, color: "#FFFFFF", margin: "0 0 4px" }}>
        Uvezi leadove iz HeyReach-a
      </p>
      <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", margin: "0 0 16px" }}>
        Povlači sve leadove iz svih kampanja ovog klijenta i kreira people + lead_assignments. Bezbedno za ponavljanje.
      </p>

      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          style={{ backgroundColor: "#3B3B3B", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "10px", color: "#FFFFFF", padding: "8px 12px", fontSize: "13px", outline: "none" }}
        >
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <button
          onClick={run}
          disabled={loading || !clientId}
          style={{
            backgroundColor: loading ? "rgba(255,204,0,0.3)" : "#FFCC00",
            color: "#272727", fontWeight: 700, border: "none",
            borderRadius: "10px", padding: "8px 20px", fontSize: "13px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Uvozim…" : "Pokreni import"}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: "14px", display: "flex", gap: "20px", flexWrap: "wrap" }}>
          {[
            { label: "Povučeno iz HR", value: result.fetched },
            { label: "Novih people", value: result.people },
            { label: "Novih assignments", value: result.assignments },
            { label: "Preskočeno", value: result.skipped },
            { label: "Grešaka", value: result.errors },
          ].map((s) => (
            <div key={s.label}>
              <span style={{ fontSize: "20px", fontWeight: 700, color: s.label === "Grešaka" && s.value > 0 ? "#F87171" : "#86EFAC" }}>
                {s.value}
              </span>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", margin: "2px 0 0" }}>{s.label}</p>
            </div>
          ))}
          {result.errors_detail?.length ? (
            <details style={{ width: "100%", marginTop: "8px" }}>
              <summary style={{ fontSize: "12px", color: "#F87171", cursor: "pointer" }}>Detalji grešaka</summary>
              <pre style={{ fontSize: "11px", color: "#BDBDBD", marginTop: "6px", whiteSpace: "pre-wrap" }}>
                {result.errors_detail.join("\n")}
              </pre>
            </details>
          ) : null}
        </div>
      )}

      {err && (
        <p style={{ marginTop: "12px", fontSize: "13px", color: "#F87171" }}>{err}</p>
      )}
    </div>
  );
}
