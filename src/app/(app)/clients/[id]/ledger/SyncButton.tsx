"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SyncButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "syncing">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function sync() {
    setState("syncing");
    setMsg(null);
    try {
      const res = await fetch(`/api/heyreach/sync/${clientId}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Sync nije uspeo.");
      setMsg(
        `✓ ${body.matched}/${body.assignments} matchovano · ${body.accepted} prihvaćeno · ${body.replied} odgovorilo` +
          (body.updated ? ` · ${body.updated} ažurirano` : "")
      );
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
        onClick={sync}
        disabled={state === "syncing"}
        style={{ backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#FFFFFF", borderRadius: "12px", padding: "10px 20px", fontSize: "14px", cursor: state === "syncing" ? "not-allowed" : "pointer", opacity: state === "syncing" ? 0.5 : 1 }}
      >
        {state === "syncing" ? "Sinhronizujem…" : "↻ Sync iz HeyReach-a"}
      </button>
      {msg && (
        <span style={{ fontSize: "12px", color: msg.startsWith("✓") ? "#86EFAC" : "#F87171" }}>{msg}</span>
      )}
    </div>
  );
}
