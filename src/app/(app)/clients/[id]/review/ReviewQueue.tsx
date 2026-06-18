"use client";

import { useState, useTransition } from "react";
import { setMemberReviewStatus, bulkSetReviewStatus } from "@/app/actions/review";

interface Lead {
  id: string;
  audience_id: string;
  review_status: string;
  qualify_source: string | null;
  qualify_reason: string | null;
  raw: {
    first_name?: string;
    last_name?: string;
    full_name?: string;
    title?: string;
    company_name?: string;
    company_domain?: string;
    industry?: string;
    location?: string;
    linkedin_url?: string;
    email?: string;
    fit_score?: number;
    priority?: string;
    score_explanation?: string;
    personalization?: string;
  };
}

const PRIORITY_ACCENT: Record<string, string> = {
  tier_1: "#86EFAC",
  tier_2: "#A5B4FC",
  tier_3: "#FFCC00",
  tier_4: "rgba(255,255,255,0.35)",
};

const PRIORITY_BORDER: Record<string, string> = {
  tier_1: "rgba(134,239,172,0.25)",
  tier_2: "rgba(165,180,252,0.25)",
  tier_3: "rgba(255,204,0,0.25)",
  tier_4: "rgba(255,255,255,0.06)",
};

function LeadCard({
  lead,
  clientId,
  selected,
  onSelect,
}: {
  lead: Lead;
  clientId: string;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const r = lead.raw;
  const name = r.full_name || `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim();
  const priority = r.priority ?? "tier_4";
  const isApproved = lead.review_status === "approved";
  const isRejected = lead.review_status === "rejected";
  const accentColor = PRIORITY_ACCENT[priority] ?? "rgba(255,255,255,0.35)";
  const borderColor = PRIORITY_BORDER[priority] ?? "rgba(255,255,255,0.06)";

  function toggle(status: "approved" | "rejected") {
    startTransition(() =>
      setMemberReviewStatus(lead.id, status, clientId, lead.audience_id)
    );
  }

  return (
    <div style={{ backgroundColor: "#303030", border: `1px solid ${borderColor}`, borderRadius: "14px", padding: "16px", opacity: isPending ? 0.6 : 1, borderLeft: `3px solid ${accentColor}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect(lead.id)}
          style={{ marginTop: "4px", width: "16px", height: "16px", accentColor: "#FFCC00", flexShrink: 0 }}
        />

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600, color: "#FFFFFF", fontSize: "14px" }}>{name}</span>
                {r.linkedin_url && (
                  <a href={r.linkedin_url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: "12px", color: "#A5B4FC", textDecoration: "none" }}>↗ LinkedIn</a>
                )}
                {r.fit_score != null && (
                  <span style={{ fontSize: "12px", color: accentColor, fontWeight: 600 }}>
                    {r.fit_score}/100 · {priority.replace("_", " ").toUpperCase()}
                  </span>
                )}
              </div>
              <p style={{ fontSize: "13px", color: "#BDBDBD", marginTop: "2px" }}>
                {[r.title, r.company_name].filter(Boolean).join(" @ ")}
                {r.company_domain && <span style={{ marginLeft: "4px", fontFamily: "monospace", fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>({r.company_domain})</span>}
              </p>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>
                {[r.industry, r.location].filter(Boolean).join(" · ")}
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
              <button
                onClick={() => toggle("approved")}
                disabled={isPending}
                style={isApproved
                  ? { backgroundColor: "rgba(134,239,172,0.15)", border: "1px solid rgba(134,239,172,0.3)", color: "#86EFAC", borderRadius: "10px", padding: "6px 14px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }
                  : { backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#BDBDBD", borderRadius: "10px", padding: "6px 14px", fontSize: "13px", cursor: "pointer" }
                }
              >
                {isApproved ? "✓ Approved" : "Approve"}
              </button>
              <button
                onClick={() => toggle("rejected")}
                disabled={isPending}
                style={isRejected
                  ? { backgroundColor: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#F87171", borderRadius: "10px", padding: "6px 14px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }
                  : { backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#BDBDBD", borderRadius: "10px", padding: "6px 14px", fontSize: "13px", cursor: "pointer" }
                }
              >
                {isRejected ? "✗ Rejected" : "Reject"}
              </button>
            </div>
          </div>

          {/* Score explanation */}
          {r.score_explanation && (
            <p style={{ marginTop: "8px", fontSize: "12px", color: "#BDBDBD", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "8px 12px" }}>
              {r.score_explanation}
            </p>
          )}

          {/* Personalization */}
          {r.personalization && (
            <div style={{ marginTop: "8px", display: "flex", alignItems: "flex-start", gap: "6px" }}>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", flexShrink: 0, marginTop: "2px" }}>Personalizacija:</span>
              <p style={{ fontSize: "12px", color: "#BDBDBD", fontStyle: "italic" }}>{r.personalization}</p>
            </div>
          )}

          {/* Qualify reason */}
          {lead.qualify_reason && (
            <p style={{ marginTop: "4px", fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
              Izvor: {lead.qualify_source?.replace("_", " ")} — {lead.qualify_reason}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReviewQueue({
  leads,
  clientId,
  audienceId,
  campaignName,
}: {
  leads: Lead[];
  clientId: string;
  audienceId: string;
  campaignName: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [isPending, startTransition] = useTransition();
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  const filtered = leads.filter((l) => tab === "all" || l.review_status === tab);
  const approvedCount = leads.filter((l) => l.review_status === "approved").length;
  const pendingCount = leads.filter((l) => l.review_status === "pending").length;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(filtered.map((l) => l.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function bulkAction(status: "approved" | "rejected") {
    const ids = Array.from(selected);
    if (!ids.length) return;
    startTransition(async () => {
      await bulkSetReviewStatus(ids, status, clientId, audienceId);
      setSelected(new Set());
    });
  }

  async function pushToHeyReach() {
    setPushStatus("pushing");
    try {
      const res = await fetch(`/api/heyreach/${audienceId}/push`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Push failed.");
      setPushStatus(`✓ Pushed ${body.pushed} leadova u HeyReach`);
    } catch (e: any) {
      setPushStatus(`✗ ${e.message}`);
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: "14px", color: "#BDBDBD" }}>{campaignName}</p>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>
            {pendingCount} na čekanju · {approvedCount} approved
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          {selected.size > 0 && (
            <>
              <span style={{ fontSize: "13px", color: "#BDBDBD" }}>{selected.size} selektovano</span>
              <button onClick={() => bulkAction("approved")} disabled={isPending}
                style={{ backgroundColor: "rgba(134,239,172,0.15)", border: "1px solid rgba(134,239,172,0.3)", color: "#86EFAC", borderRadius: "10px", padding: "8px 16px", fontSize: "13px", cursor: "pointer", opacity: isPending ? 0.5 : 1 }}>
                Approve sve
              </button>
              <button onClick={() => bulkAction("rejected")} disabled={isPending}
                style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#F87171", borderRadius: "10px", padding: "8px 16px", fontSize: "13px", cursor: "pointer", opacity: isPending ? 0.5 : 1 }}>
                Reject sve
              </button>
              <button onClick={clearSelection} style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer" }}>
                Otkaži
              </button>
            </>
          )}
          {approvedCount > 0 && (
            <button
              onClick={pushToHeyReach}
              disabled={pushStatus === "pushing"}
              style={{ backgroundColor: "#FFCC00", color: "#272727", fontWeight: 600, borderRadius: "12px", padding: "10px 20px", fontSize: "14px", border: "none", cursor: pushStatus === "pushing" ? "not-allowed" : "pointer", opacity: pushStatus === "pushing" ? 0.6 : 1 }}
            >
              {pushStatus === "pushing" ? "Šaljem…" : `Push ${approvedCount} u HeyReach →`}
            </button>
          )}
        </div>
      </div>

      {pushStatus && pushStatus !== "pushing" && (
        <p style={{ marginBottom: "12px", borderRadius: "10px", padding: "10px 16px", fontSize: "13px", backgroundColor: pushStatus.startsWith("✓") ? "rgba(134,239,172,0.08)" : "rgba(239,68,68,0.08)", color: pushStatus.startsWith("✓") ? "#86EFAC" : "#F87171", border: pushStatus.startsWith("✓") ? "1px solid rgba(134,239,172,0.2)" : "1px solid rgba(239,68,68,0.2)" }}>
          {pushStatus}
        </p>
      )}

      {/* Tabs */}
      <div style={{ marginBottom: "16px", display: "flex", gap: "8px", alignItems: "center" }}>
        {(["all", "pending", "approved", "rejected"] as const).map((t) => {
          const count = t === "all" ? leads.length : leads.filter((l) => l.review_status === t).length;
          return (
            <button key={t} onClick={() => setTab(t)}
              style={tab === t
                ? { backgroundColor: "#FFCC00", color: "#272727", fontWeight: 600, borderRadius: "999px", padding: "5px 14px", fontSize: "12px", border: "none", cursor: "pointer", textTransform: "capitalize" as const }
                : { backgroundColor: "rgba(255,255,255,0.06)", color: "#BDBDBD", borderRadius: "999px", padding: "5px 14px", fontSize: "12px", border: "none", cursor: "pointer", textTransform: "capitalize" as const }
              }>
              {t} ({count})
            </button>
          );
        })}
        <button onClick={selectAll} style={{ marginLeft: "auto", fontSize: "12px", color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
          Select all {filtered.length}
        </button>
      </div>

      {/* Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {filtered.length === 0 ? (
          <p style={{ padding: "32px", textAlign: "center", fontSize: "14px", color: "rgba(255,255,255,0.35)" }}>Nema leadova u ovom filteru.</p>
        ) : (
          filtered.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              clientId={clientId}
              selected={selected.has(lead.id)}
              onSelect={toggleSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}
