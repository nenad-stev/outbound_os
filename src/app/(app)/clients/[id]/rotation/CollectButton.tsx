"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CollectButton({ clientId, pool }: { clientId: string; pool: "rotation" | "followups" }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function collect() {
    setState("running");
    setMsg(null);
    try {
      const res = await fetch(`/api/pools/collect/${clientId}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.errors?.[0] ?? "Greška pri skeniranju.");
      const added = pool === "rotation" ? body.rotation_added : body.followup_added;
      setMsg(added > 0 ? `+${added} novih` : "Nema novih");
      router.refresh();
    } catch (e: any) {
      setMsg(`✗ ${e.message}`);
    } finally {
      setState("idle");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
      <button
        onClick={collect}
        disabled={state === "running"}
        style={{ backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#FFFFFF", borderRadius: "12px", padding: "10px 20px", fontSize: "14px", cursor: state === "running" ? "not-allowed" : "pointer", opacity: state === "running" ? 0.5 : 1 }}
      >
        {state === "running" ? "Skeniranje…" : "↻ Skeniraj eligibilne"}
      </button>
      {msg && (
        <span style={{ fontSize: "12px", color: msg.startsWith("✗") ? "#F87171" : "#86EFAC" }}>{msg}</span>
      )}
    </div>
  );
}
