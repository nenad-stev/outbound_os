"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  audienceId: string;
  clientId: string;
  total: number;
}

export default function StartPipelineButton({ audienceId, clientId, total }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pipeline/${audienceId}/start`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Pipeline nije mogao da startuje.");
      }
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
      <button
        onClick={start}
        disabled={loading}
        style={{
          backgroundColor: "#FFCC00",
          color: "#272727",
          fontWeight: 600,
          borderRadius: "12px",
          padding: "10px 20px",
          fontSize: "14px",
          border: "none",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
          whiteSpace: "nowrap",
        }}
      >
        {loading
          ? "Starting pipeline…"
          : `Start qualify + enrich + score (${total} leads)`}
      </button>
      {error && (
        <p style={{ fontSize: "12px", color: "#F87171" }}>{error}</p>
      )}
    </div>
  );
}
