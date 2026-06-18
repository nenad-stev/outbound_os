"use client";

import { Fragment, useState } from "react";
import { renderTemplateSegments } from "@/lib/message-preview";

interface SequenceStep {
  step_order: number;
  channel: string;
  template_text: string;
  ai_instructions: string | null;
  delay_days: number;
}

interface Member {
  id: string;
  qualify_status: string;
  qualify_source: string | null;
  qualify_reason: string | null;
  raw: any;
}

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  pending:             { backgroundColor: "rgba(255,255,255,0.08)", color: "#BDBDBD" },
  qualified:           { backgroundColor: "rgba(134,239,172,0.12)", color: "#86EFAC" },
  disqualified:        { backgroundColor: "rgba(239,68,68,0.12)", color: "#F87171" },
  not_able_to_qualify: { backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" },
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending", qualified: "Qualified", disqualified: "Disqualified", not_able_to_qualify: "No data",
};

const PRIORITY_STYLES: Record<string, React.CSSProperties> = {
  tier_1: { backgroundColor: "rgba(134,239,172,0.12)", color: "#86EFAC", fontWeight: 600 },
  tier_2: { backgroundColor: "rgba(99,102,241,0.15)", color: "#A5B4FC" },
  tier_3: { backgroundColor: "rgba(255,204,0,0.12)", color: "#FFCC00" },
  tier_4: { backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" },
};

const DM_STYLES: Record<string, React.CSSProperties> = {
  yes:     { backgroundColor: "rgba(134,239,172,0.12)", color: "#86EFAC" },
  likely:  { backgroundColor: "rgba(99,102,241,0.15)", color: "#A5B4FC" },
  unlikely:{ backgroundColor: "rgba(255,204,0,0.12)", color: "#FFCC00" },
  no:      { backgroundColor: "rgba(239,68,68,0.12)", color: "#F87171" },
  unknown: { backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" },
};

const CHANNEL_LABELS: Record<string, string> = {
  connection_request: "Connection request", message: "Message", inmail: "InMail",
};

function ActivityBadge({ score }: { score: number }) {
  const style: React.CSSProperties =
    score >= 70
      ? { backgroundColor: "rgba(134,239,172,0.12)", color: "#86EFAC" }
      : score >= 40
        ? { backgroundColor: "rgba(255,204,0,0.12)", color: "#FFCC00" }
        : score > 0
          ? { backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }
          : { backgroundColor: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.2)" };

  return (
    <span
      style={{
        ...style,
        borderRadius: "6px",
        padding: "2px 7px",
        fontSize: "11px",
        fontWeight: 500,
      }}
    >
      {score}
    </span>
  );
}

function ProvChip({ label, state }: { label: string; state: string }) {
  const ok = ["ok", "enriched"].includes(state);
  const empty = ["no_content", "no_data"].includes(state);
  const style: React.CSSProperties = ok
    ? { backgroundColor: "rgba(134,239,172,0.1)", color: "#86EFAC", borderColor: "rgba(134,239,172,0.3)" }
    : empty
      ? { backgroundColor: "rgba(239,68,68,0.1)", color: "#F87171", borderColor: "rgba(239,68,68,0.3)" }
      : { backgroundColor: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.1)" };
  const icon = ok ? "✓" : empty ? "✗" : "–";
  return (
    <span
      style={{
        ...style,
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        border: "1px solid",
        borderRadius: "6px",
        padding: "2px 8px",
        fontSize: "11px",
      }}
      title={`${label}: ${state}`}
    >
      <span style={{ fontWeight: 600 }}>{icon}</span> {label}
    </span>
  );
}

function MiniProvenance({ p }: { p: any }) {
  if (!p) return <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)" }}>—</span>;
  const items: [string, string][] = [
    ["FC", p.firecrawl_website],
    ["BDp", p.brightdata_person],
    ["BDc", p.brightdata_company],
    ["AI", p.ai_score],
  ];
  return (
    <div style={{ display: "flex", gap: "3px" }}>
      {items.map(([k, v]) => {
        const ok = ["ok", "enriched"].includes(v);
        const empty = ["no_content", "no_data"].includes(v);
        const color = ok ? "#86EFAC" : empty ? "#F87171" : "rgba(255,255,255,0.2)";
        return (
          <span
            key={k}
            title={`${k}: ${v}`}
            style={{
              height: "8px",
              width: "8px",
              borderRadius: "50%",
              backgroundColor: color,
              display: "inline-block",
            }}
          />
        );
      })}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "" || value === false) return null;
  return (
    <div style={{ display: "flex", gap: "8px", fontSize: "12px", marginBottom: "4px" }}>
      <span style={{ width: "128px", flexShrink: 0, color: "rgba(255,255,255,0.35)" }}>{label}</span>
      <span style={{ color: "#BDBDBD" }}>{value}</span>
    </div>
  );
}

function MessagePreview({ steps, lead }: { steps: SequenceStep[]; lead: any }) {
  if (!steps.length) {
    return <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>No sequence steps defined for this campaign.</p>;
  }
  const leadData = {
    first_name: lead.first_name, last_name: lead.last_name, full_name: lead.full_name,
    company_name: lead.company_name, title: lead.title, personalization: lead.personalization,
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {steps.map((s) => {
        const segs = renderTemplateSegments(s.template_text ?? "", leadData);
        return (
          <div
            key={s.step_order}
            style={{
              backgroundColor: "#303030",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "12px",
              padding: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: 500, color: "#FFFFFF" }}>Step {s.step_order}</span>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>· {CHANNEL_LABELS[s.channel] ?? s.channel}</span>
              {s.delay_days > 0 && <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>· +{s.delay_days}d</span>}
            </div>
            <p style={{ whiteSpace: "pre-wrap", fontSize: "13px", lineHeight: 1.6, color: "#BDBDBD" }}>
              {segs.map((seg, i) => (
                <span
                  key={i}
                  style={
                    seg.kind === "personalization"
                      ? { backgroundColor: "rgba(99,102,241,0.2)", color: "#A5B4FC", borderRadius: "3px", padding: "0 2px" }
                      : seg.kind === "missing"
                        ? { backgroundColor: "rgba(255,204,0,0.15)", color: "#FFCC00", borderRadius: "3px", padding: "0 2px" }
                        : {}
                  }
                >
                  {seg.text}
                </span>
              ))}
            </p>
          </div>
        );
      })}
    </div>
  );
}

const HEADERS = ["", "Name", "Title", "Company", "Status", "Score", "Tier", "DM", "Activity", "Connections", "Enrich"];

export default function MembersTable({
  members,
  steps,
}: {
  members: Member[];
  steps: SequenceStep[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div
      style={{
        borderRadius: "16px",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
          <thead>
            <tr style={{ backgroundColor: "#1E1E1E" }}>
              {HEADERS.map((h, i) => (
                <th
                  key={i}
                  style={{
                    padding: "12px 12px",
                    textAlign: "left",
                    fontSize: "11px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "rgba(255,255,255,0.35)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m, rowIdx) => {
              const r = m.raw ?? {};
              const li = r.linkedin ?? {};
              const co = r.company_enrichment ?? null;
              const ai = r.ai_fit ?? {};
              const prov = r.provenance ?? null;
              const dm = ai.decision_maker_signal ?? "unknown";
              const isOpen = expanded === m.id;
              const name = r.full_name || `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "—";

              return (
                <Fragment key={m.id}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : m.id)}
                    style={{
                      backgroundColor: isOpen ? "#3B3B3B" : "#303030",
                      borderTop: rowIdx > 0 ? "1px solid rgba(255,255,255,0.05)" : "none",
                      cursor: "pointer",
                      verticalAlign: "top",
                      transition: "background-color 0.15s",
                    }}
                    onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.backgroundColor = "#3B3B3B"; }}
                    onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.backgroundColor = "#303030"; }}
                  >
                    <td style={{ padding: "12px 12px", color: "rgba(255,255,255,0.35)", fontSize: "12px" }}>
                      {isOpen ? "▾" : "▸"}
                    </td>
                    <td style={{ padding: "12px 12px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 500, color: "#FFFFFF" }}>{name}</span>
                        {r.linkedin_url && (
                          <a
                            href={r.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{ fontSize: "11px", color: "#A5B4FC" }}
                          >
                            ↗
                          </a>
                        )}
                      </div>
                      {li.headline && (
                        <p
                          style={{
                            marginTop: "2px",
                            maxWidth: "180px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontSize: "11px",
                            color: "rgba(255,255,255,0.35)",
                          }}
                        >
                          {li.headline}
                        </p>
                      )}
                    </td>
                    <td style={{ padding: "12px 12px", color: "#BDBDBD", maxWidth: "150px" }}>
                      <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontSize: "13px" }}>
                        {r.title ?? "—"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 12px", maxWidth: "140px" }}>
                      <span
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          fontSize: "13px",
                          color: "#BDBDBD",
                        }}
                      >
                        {r.company_name ?? "—"}
                      </span>
                      {r.company_domain && (
                        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>
                          {r.company_domain}
                        </p>
                      )}
                    </td>
                    <td style={{ padding: "12px 12px", whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          ...(STATUS_STYLES[m.qualify_status] ?? {}),
                          borderRadius: "999px",
                          padding: "3px 10px",
                          fontSize: "11px",
                          fontWeight: 500,
                        }}
                      >
                        {STATUS_LABELS[m.qualify_status] ?? m.qualify_status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                      {r.fit_score != null
                        ? <span style={{ fontSize: "13px", fontWeight: 600, color: "#FFFFFF" }}>{r.fit_score}</span>
                        : <span style={{ color: "rgba(255,255,255,0.35)" }}>—</span>
                      }
                    </td>
                    <td style={{ padding: "12px 12px", whiteSpace: "nowrap" }}>
                      {r.priority ? (
                        <span
                          style={{
                            ...(PRIORITY_STYLES[r.priority] ?? {}),
                            borderRadius: "999px",
                            padding: "3px 10px",
                            fontSize: "11px",
                          }}
                        >
                          {r.priority.replace("_", " ").toUpperCase()}
                        </span>
                      ) : <span style={{ color: "rgba(255,255,255,0.35)" }}>—</span>}
                    </td>
                    <td style={{ padding: "12px 12px", whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          ...(DM_STYLES[dm] ?? {}),
                          borderRadius: "999px",
                          padding: "3px 10px",
                          fontSize: "11px",
                          fontWeight: 500,
                          textTransform: "capitalize",
                        }}
                      >
                        {dm}
                      </span>
                    </td>
                    <td style={{ padding: "12px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                      {li.activity_score != null ? <ActivityBadge score={li.activity_score} /> : <span style={{ color: "rgba(255,255,255,0.35)" }}>—</span>}
                    </td>
                    <td style={{ padding: "12px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                      {li.connections != null ? (
                        <span style={{ fontSize: "13px", color: li.has_200_plus_connections ? "#FFFFFF" : "#BDBDBD", fontWeight: li.has_200_plus_connections ? 600 : 400 }}>
                          {li.connections}
                        </span>
                      ) : <span style={{ color: "rgba(255,255,255,0.35)" }}>—</span>}
                    </td>
                    <td style={{ padding: "12px 12px" }}>
                      <MiniProvenance p={prov} />
                    </td>
                  </tr>

                  {isOpen && (
                    <tr style={{ backgroundColor: "rgba(59,59,59,0.5)" }}>
                      <td colSpan={HEADERS.length} style={{ padding: "24px 24px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px" }}>
                          {/* Left: enrichment */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div>
                              <p
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.08em",
                                  color: "rgba(255,255,255,0.35)",
                                  marginBottom: "8px",
                                }}
                              >
                                Enrichment trail
                              </p>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                <ProvChip label="Firecrawl" state={prov?.firecrawl_website ?? "skipped"} />
                                <ProvChip label="BD person" state={prov?.brightdata_person ?? "skipped"} />
                                <ProvChip label="BD company" state={prov?.brightdata_company ?? "skipped"} />
                                <ProvChip label="AI qualify" state={prov?.ai_qualify ?? "skipped"} />
                                <ProvChip label="AI score" state={prov?.ai_score ?? "skipped"} />
                              </div>
                              {prov?.qualified_via && (
                                <p style={{ marginTop: "6px", fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
                                  Qualified via: <span style={{ color: "#BDBDBD" }}>{prov.qualified_via}</span>
                                </p>
                              )}
                              {m.qualify_reason && (
                                <p style={{ marginTop: "4px", fontSize: "12px", color: "#BDBDBD", fontStyle: "italic" }}>{m.qualify_reason}</p>
                              )}
                            </div>

                            <div>
                              <p
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.08em",
                                  color: "rgba(255,255,255,0.35)",
                                  marginBottom: "6px",
                                }}
                              >
                                LinkedIn
                              </p>
                              <Field label="Headline" value={li.headline} />
                              <Field label="Connections" value={li.connections != null ? `${li.connections}${li.has_200_plus_connections ? " (200+)" : ""}` : null} />
                              <Field label="Activity score" value={li.activity_score} />
                              <Field label="Active 30d" value={li.active_last_30_days ? "Yes" : null} />
                              <Field label="Posted 30d" value={li.posted_last_30_days ? "Yes" : null} />
                              <Field label="Profile photo" value={li.has_profile_photo ? "Yes" : "No"} />
                              {li.about && (
                                <div style={{ marginTop: "4px", fontSize: "12px" }}>
                                  <span style={{ color: "rgba(255,255,255,0.35)" }}>About</span>
                                  <p
                                    style={{
                                      marginTop: "2px",
                                      color: "#BDBDBD",
                                      overflow: "hidden",
                                      display: "-webkit-box",
                                      WebkitLineClamp: 4,
                                      WebkitBoxOrient: "vertical",
                                    }}
                                  >
                                    {li.about}
                                  </p>
                                </div>
                              )}
                            </div>

                            {co && (
                              <div>
                                <p
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 600,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.08em",
                                    color: "rgba(255,255,255,0.35)",
                                    marginBottom: "6px",
                                  }}
                                >
                                  Company
                                </p>
                                <Field label="Industry" value={co.industry} />
                                <Field label="Size" value={co.company_size} />
                                <Field label="Employees" value={co.employee_count} />
                                <Field label="HQ" value={co.headquarters} />
                                <Field label="Founded" value={co.founded} />
                                <Field label="Website" value={co.website} />
                                {co.about && (
                                  <div style={{ marginTop: "4px", fontSize: "12px" }}>
                                    <span style={{ color: "rgba(255,255,255,0.35)" }}>About</span>
                                    <p
                                      style={{
                                        marginTop: "2px",
                                        color: "#BDBDBD",
                                        overflow: "hidden",
                                        display: "-webkit-box",
                                        WebkitLineClamp: 4,
                                        WebkitBoxOrient: "vertical",
                                      }}
                                    >
                                      {co.about}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Middle: AI fit */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <p
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                color: "rgba(255,255,255,0.35)",
                              }}
                            >
                              AI fit
                            </p>
                            {r.score_explanation && (
                              <p style={{ fontSize: "12px", color: "#BDBDBD" }}>{r.score_explanation}</p>
                            )}
                            {ai.role_fit_notes && (
                              <Field label="Role fit" value={ai.role_fit_notes} />
                            )}
                            {Array.isArray(ai.linkedin_fit_signals) && ai.linkedin_fit_signals.length > 0 && (
                              <div>
                                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginBottom: "4px" }}>Fit signals</p>
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                  {ai.linkedin_fit_signals.map((s: string, i: number) => (
                                    <span
                                      key={i}
                                      style={{
                                        backgroundColor: "rgba(134,239,172,0.1)",
                                        color: "#86EFAC",
                                        borderRadius: "6px",
                                        padding: "3px 8px",
                                        fontSize: "12px",
                                      }}
                                    >
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {Array.isArray(ai.linkedin_red_flags) && ai.linkedin_red_flags.length > 0 && (
                              <div>
                                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginBottom: "4px" }}>Red flags</p>
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                  {ai.linkedin_red_flags.map((s: string, i: number) => (
                                    <span
                                      key={i}
                                      style={{
                                        backgroundColor: "rgba(239,68,68,0.1)",
                                        color: "#F87171",
                                        borderRadius: "6px",
                                        padding: "3px 8px",
                                        fontSize: "12px",
                                      }}
                                    >
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Right: message preview */}
                          <div>
                            <p
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                color: "rgba(255,255,255,0.35)",
                                marginBottom: "8px",
                              }}
                            >
                              Message they receive
                            </p>
                            <MessagePreview steps={steps} lead={r} />
                            <p style={{ marginTop: "8px", fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                              <span style={{ backgroundColor: "rgba(99,102,241,0.2)", color: "#A5B4FC", borderRadius: "3px", padding: "0 4px" }}>purple</span>
                              {" "}= personalization ·{" "}
                              <span style={{ backgroundColor: "rgba(255,204,0,0.15)", color: "#FFCC00", borderRadius: "3px", padding: "0 4px" }}>yellow</span>
                              {" "}= missing
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {members.length === 0 && (
        <p style={{ padding: "32px", textAlign: "center", fontSize: "14px", color: "#BDBDBD" }}>
          No leads match the selected filter.
        </p>
      )}
    </div>
  );
}
