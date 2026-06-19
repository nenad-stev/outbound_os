"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMemberReviewStatus, bulkSetReviewStatus, updateMemberMessage } from "@/app/actions/review";
import { downloadCsv } from "@/lib/csv-export";
import { nameSequenceSteps, type SeqStep, type NamedStep } from "@/lib/sequence";

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
    rendered_messages?: Record<string, string>;
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

// Which steps actually require a rendered message before push (operator wrote a template).
function requiredSteps(named: NamedStep[]): NamedStep[] {
  return named.filter((s) => (s.template_text ?? "").trim());
}

function leadMissingMessages(lead: Lead, named: NamedStep[]): boolean {
  const rm = lead.raw.rendered_messages ?? {};
  return requiredSteps(named).some((s) => !(rm[String(s.step_order)] ?? "").trim());
}

function StepEditor({
  step,
  initial,
  onSave,
}: {
  step: NamedStep;
  initial: string;
  onSave: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = text !== initial;
  const empty = !text.trim();

  async function save() {
    setSaving(true);
    await onSave(text);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div style={{ backgroundColor: "rgba(165,180,252,0.05)", border: `1px solid ${empty ? "rgba(248,113,113,0.3)" : "rgba(165,180,252,0.15)"}`, borderRadius: "10px", padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "#A5B4FC" }}>{step.step_order}. {step.label}</span>
        <span title="Referenciraj ovu varijablu u HeyReach sekvenci"
          style={{ fontSize: "10px", fontFamily: "monospace", color: "rgba(255,255,255,0.5)", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "4px", padding: "1px 6px" }}>
          {`{{${step.variableName}}}`}
        </span>
        {step.delay_days ? <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>+{step.delay_days}d</span> : null}
        {empty && <span style={{ fontSize: "10px", color: "#F87171" }}>⚠ nije generisano</span>}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={Math.max(2, Math.min(6, text.split("\n").length + 1))}
        placeholder={`Template: ${step.template_text}`}
        style={{ backgroundColor: "#272727", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#FFFFFF", padding: "8px 10px", fontSize: "12px", width: "100%", outline: "none", resize: "vertical", lineHeight: 1.5 }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "6px" }}>
        <button onClick={save} disabled={saving || !dirty}
          style={{ backgroundColor: dirty ? "#FFCC00" : "rgba(255,255,255,0.08)", color: dirty ? "#272727" : "rgba(255,255,255,0.4)", fontWeight: 600, borderRadius: "8px", padding: "4px 12px", fontSize: "12px", border: "none", cursor: saving || !dirty ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Čuvam…" : saved ? "✓ Sačuvano" : "Sačuvaj"}
        </button>
        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>Template: {step.template_text}</span>
      </div>
    </div>
  );
}

function LeadCard({
  lead,
  clientId,
  selected,
  onSelect,
  namedSteps,
}: {
  lead: Lead;
  clientId: string;
  selected: boolean;
  onSelect: (id: string) => void;
  namedSteps: NamedStep[];
}) {
  const [isPending, startTransition] = useTransition();
  const r = lead.raw;
  const name = r.full_name || `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim();
  const priority = r.priority ?? "tier_4";
  const isApproved = lead.review_status === "approved";
  const isRejected = lead.review_status === "rejected";
  const accentColor = PRIORITY_ACCENT[priority] ?? "rgba(255,255,255,0.35)";
  const borderColor = PRIORITY_BORDER[priority] ?? "rgba(255,255,255,0.06)";

  const [showMsgs, setShowMsgs] = useState(false);
  const rendered = r.rendered_messages ?? {};
  const required = requiredSteps(namedSteps);

  const missingLinkedIn = !r.linkedin_url;
  const missingMsgs = leadMissingMessages(lead, namedSteps);
  const blockers: string[] = [];
  if (missingLinkedIn) blockers.push("nema LinkedIn URL");
  if (missingMsgs) blockers.push("nema poruku");

  function toggle(status: "approved" | "rejected") {
    startTransition(() => setMemberReviewStatus(lead.id, status, clientId, lead.audience_id));
  }

  return (
    <div style={{ backgroundColor: "#303030", border: `1px solid ${borderColor}`, borderRadius: "14px", padding: "16px", opacity: isPending ? 0.6 : 1, borderLeft: `3px solid ${accentColor}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect(lead.id)}
          style={{ marginTop: "4px", width: "16px", height: "16px", accentColor: "#FFCC00", flexShrink: 0 }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
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
                {blockers.length > 0 && (
                  <span title={`Push će preskočiti: ${blockers.join(", ")}`}
                    style={{ fontSize: "11px", fontWeight: 600, color: "#F87171", backgroundColor: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "999px", padding: "1px 8px" }}>
                    ⚠ {blockers.join(", ")}
                  </span>
                )}
              </div>
              <p style={{ fontSize: "13px", color: "#BDBDBD", marginTop: "2px", overflowWrap: "anywhere" }}>
                {[r.title, r.company_name].filter(Boolean).join(" @ ")}
                {r.company_domain && <span style={{ marginLeft: "4px", fontFamily: "monospace", fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>({r.company_domain})</span>}
              </p>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>
                {[r.industry, r.location].filter(Boolean).join(" · ")}
              </p>
            </div>

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

          {/* Editable per-step messages (the text pushed to HeyReach per variable) */}
          {required.length > 0 ? (
            <div style={{ marginTop: "10px" }}>
              <button onClick={() => setShowMsgs((v) => !v)}
                style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "12px", fontWeight: 600, color: "#A5B4FC" }}>
                <span>Poruke za ovog leada ({required.length})</span>
                <span style={{ fontSize: "11px", color: missingMsgs ? "#F87171" : "rgba(255,255,255,0.35)" }}>
                  {missingMsgs ? "⚠ neke nisu generisane" : "✓ spremno"}
                </span>
                <span style={{ display: "inline-block", transform: showMsgs ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
              </button>
              {showMsgs && (
                <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {required.map((step) => (
                    <StepEditor
                      key={step.step_order}
                      step={step}
                      initial={rendered[String(step.step_order)] ?? ""}
                      onSave={(text) => updateMemberMessage(lead.id, step.step_order, text, clientId)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p style={{ marginTop: "10px", fontSize: "12px", color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>
              Kampanja nema sequence poruke. Dodaj korake u Campaigns da bi se generisale poruke.
            </p>
          )}

          {/* Qualify reason */}
          {lead.qualify_reason && (
            <p style={{ marginTop: "8px", fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
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
  initialBrief,
  sequenceSteps,
  heyreachIssues,
}: {
  leads: Lead[];
  clientId: string;
  audienceId: string;
  campaignName: string;
  initialBrief: string;
  sequenceSteps: SeqStep[];
  heyreachIssues: string[];
}) {
  const router = useRouter();
  const namedSteps = nameSequenceSteps(sequenceSteps);
  const required = requiredSteps(namedSteps);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [isPending, startTransition] = useTransition();
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  // Batch message generation
  const [showRegen, setShowRegen] = useState(false);
  const [brief, setBrief] = useState(initialBrief);
  const [regenScope, setRegenScope] = useState<"all" | "pending" | "approved">("all");
  const [regenStatus, setRegenStatus] = useState<string | null>(null);

  async function regenerateMessages() {
    setRegenStatus("regen");
    try {
      const res = await fetch(`/api/review/${audienceId}/regenerate-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, scope: regenScope }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Generisanje nije uspelo.");
      setRegenStatus(`✓ Generisano za ${body.updated} leadova${body.failed ? `, ${body.failed} neuspelih` : ""}`);
      router.refresh();
    } catch (e: any) {
      setRegenStatus(`✗ ${e.message}`);
    }
  }

  const filtered = leads.filter((l) => tab === "all" || l.review_status === tab);
  const approvedCount = leads.filter((l) => l.review_status === "approved").length;
  const pendingCount = leads.filter((l) => l.review_status === "pending").length;

  // Approved leads that would be skipped on push
  const approvedBlocked = leads.filter((l) => {
    if (l.review_status !== "approved") return false;
    return !l.raw.linkedin_url || leadMissingMessages(l, namedSteps);
  }).length;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() { setSelected(new Set(filtered.map((l) => l.id))); }
  function clearSelection() { setSelected(new Set()); }

  function bulkAction(status: "approved" | "rejected") {
    const ids = Array.from(selected);
    if (!ids.length) return;
    startTransition(async () => {
      await bulkSetReviewStatus(ids, status, clientId, audienceId);
      setSelected(new Set());
    });
  }

  function exportCsv() {
    downloadCsv(`review-${tab}-${new Date().toISOString().slice(0, 10)}.csv`, filtered);
  }

  async function pushToHeyReach() {
    setPushStatus("pushing");
    try {
      const res = await fetch(`/api/heyreach/${audienceId}/push`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Push failed.");
      const skipped = body.skipped as { name: string; reason: string }[] | undefined;
      let txt = `✓ Pushed ${body.pushed} leadova u HeyReach`;
      if (skipped && skipped.length) {
        txt += ` · ${skipped.length} preskočeno (${skipped.slice(0, 3).map((s) => s.name).join(", ")}${skipped.length > 3 ? "…" : ""})`;
      }
      setPushStatus(txt);
      router.refresh();
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
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            style={{ backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: filtered.length === 0 ? "rgba(255,255,255,0.25)" : "#BDBDBD", borderRadius: "10px", padding: "8px 16px", fontSize: "13px", cursor: filtered.length === 0 ? "not-allowed" : "pointer" }}
          >
            ⬇ Export CSV ({filtered.length})
          </button>
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

      {/* Pre-push readiness warnings */}
      {(heyreachIssues.length > 0 || approvedBlocked > 0) && (
        <div style={{ marginBottom: "12px", borderRadius: "10px", padding: "10px 14px", fontSize: "12px", backgroundColor: "rgba(255,204,0,0.07)", border: "1px solid rgba(255,204,0,0.25)", color: "#FFCC00" }}>
          <span style={{ fontWeight: 600 }}>⚠ Pre push-a:</span>
          <ul style={{ margin: "4px 0 0", paddingLeft: "18px", color: "#E0C77A" }}>
            {heyreachIssues.map((issue, i) => <li key={i}>{issue}</li>)}
            {approvedBlocked > 0 && (
              <li>{approvedBlocked} approved {approvedBlocked === 1 ? "lead" : "leadova"} će biti preskočeno (fali LinkedIn URL ili poruka). Vidi ⚠ oznake na karticama.</li>
            )}
          </ul>
        </div>
      )}

      {/* Batch message generation */}
      <div style={{ marginBottom: "16px", backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "12px 14px" }}>
        <button
          onClick={() => setShowRegen((v) => !v)}
          style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%", textAlign: "left" }}
        >
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#FFFFFF" }}>Generiši poruke za batch</span>
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
            AI piše cele poruke iz template-a kampanje, popunjava [zagrade], vokativ + srpski
          </span>
          <span style={{ marginLeft: "auto", fontSize: "11px", color: "rgba(255,255,255,0.35)", transform: showRegen ? "rotate(180deg)" : "none" }}>▾</span>
        </button>

        {showRegen && (
          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {required.length === 0 ? (
              <p style={{ fontSize: "12px", color: "#F87171", margin: 0 }}>
                Kampanja nema sequence poruke. Dodaj korake (Poruka 1/2…) u Campaigns, sa [zagradama] gde želiš personalizaciju.
              </p>
            ) : (
              <>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>
                  Generiše iz: {required.map((s) => s.label).join(", ")}
                </div>
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  rows={2}
                  placeholder="Opciono: dodatni brief za stil/sadržaj personalizacije (npr. ton, šta da naglasi u [zagradama])."
                  style={{ backgroundColor: "#272727", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#FFFFFF", padding: "10px 12px", fontSize: "13px", width: "100%", outline: "none", resize: "vertical", lineHeight: 1.5 }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <label style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: "6px" }}>
                    Za:
                    <select
                      value={regenScope}
                      onChange={(e) => setRegenScope(e.target.value as any)}
                      style={{ backgroundColor: "#272727", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#FFFFFF", padding: "6px 10px", fontSize: "12px", outline: "none" }}
                    >
                      <option value="all">sve qualified ({leads.length})</option>
                      <option value="pending">samo na čekanju ({pendingCount})</option>
                      <option value="approved">samo approved ({approvedCount})</option>
                    </select>
                  </label>
                  <button
                    onClick={regenerateMessages}
                    disabled={regenStatus === "regen"}
                    style={{ backgroundColor: "#A5B4FC", color: "#272727", fontWeight: 600, borderRadius: "10px", padding: "8px 16px", fontSize: "13px", border: "none", cursor: regenStatus === "regen" ? "not-allowed" : "pointer", opacity: regenStatus === "regen" ? 0.6 : 1 }}
                  >
                    {regenStatus === "regen" ? "Generišem… (može potrajati)" : "Generiši poruke"}
                  </button>
                  {regenStatus && regenStatus !== "regen" && (
                    <span style={{ fontSize: "12px", color: regenStatus.startsWith("✓") ? "#86EFAC" : "#F87171" }}>{regenStatus}</span>
                  )}
                </div>
                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", margin: 0 }}>
                  Prepisuje sve poruke za izabrani skup. Veliki batch-evi mogu zahtevati ponovni klik ako istekne vreme.
                </p>
              </>
            )}
          </div>
        )}
      </div>

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
              namedSteps={namedSteps}
            />
          ))
        )}
      </div>
    </div>
  );
}
