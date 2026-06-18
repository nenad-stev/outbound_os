import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function first<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("sr-RS", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function statusBadge(status: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    pending_review: { backgroundColor: "rgba(255,255,255,0.08)", color: "#BDBDBD" },
    approved:       { backgroundColor: "rgba(255,204,0,0.15)", color: "#FFCC00" },
    pushed:         { backgroundColor: "rgba(99,102,241,0.15)", color: "#A5B4FC" },
    active:         { backgroundColor: "rgba(255,204,0,0.15)", color: "#FFCC00" },
    replied:        { backgroundColor: "rgba(134,239,172,0.12)", color: "#86EFAC" },
    completed:      { backgroundColor: "rgba(134,239,172,0.12)", color: "#86EFAC" },
    rotated_out:    { backgroundColor: "rgba(251,146,60,0.12)", color: "#FB923C" },
    rejected:       { backgroundColor: "rgba(239,68,68,0.08)", color: "#F87171" },
    disqualified:   { backgroundColor: "rgba(239,68,68,0.08)", color: "#F87171" },
  };
  return { ...(map[status] ?? map.pending_review), borderRadius: "999px", padding: "3px 10px", fontSize: "11px", fontWeight: 500 };
}

function qualifyBadge(status: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    qualified:           { backgroundColor: "rgba(134,239,172,0.12)", color: "#86EFAC" },
    disqualified:        { backgroundColor: "rgba(239,68,68,0.08)", color: "#F87171" },
    not_able_to_qualify: { backgroundColor: "rgba(255,255,255,0.08)", color: "#BDBDBD" },
    pending:             { backgroundColor: "rgba(255,255,255,0.08)", color: "#BDBDBD" },
  };
  const QUALIFY_LABELS: Record<string, string> = {
    qualified: "Qualified", disqualified: "Disqualified", not_able_to_qualify: "No data", pending: "Pending",
  };
  return { ...(map[status] ?? map.pending), borderRadius: "999px", padding: "3px 10px", fontSize: "11px", fontWeight: 500 };
}

const QUALIFY_LABELS: Record<string, string> = {
  qualified: "Qualified", disqualified: "Disqualified", not_able_to_qualify: "No data", pending: "Pending",
};

const CONN_LABELS: Record<string, string> = {
  not_sent: "Nije poslato", requested: "Zahtev poslat", accepted: "Prihvaćeno",
  withdrawn: "Povučeno", declined: "Odbijeno",
};

function connColor(state: string): string {
  const map: Record<string, string> = {
    not_sent: "rgba(255,255,255,0.35)", requested: "#A5B4FC", accepted: "#86EFAC",
    withdrawn: "#FB923C", declined: "#F87171",
  };
  return map[state] ?? "rgba(255,255,255,0.35)";
}

function tierBadge(priority: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    tier_1: { backgroundColor: "rgba(134,239,172,0.12)", color: "#86EFAC" },
    tier_2: { backgroundColor: "rgba(99,102,241,0.15)", color: "#A5B4FC" },
    tier_3: { backgroundColor: "rgba(251,146,60,0.12)", color: "#FB923C" },
    tier_4: { backgroundColor: "rgba(255,255,255,0.08)", color: "#BDBDBD" },
  };
  return { ...(map[priority] ?? map.tier_4), borderRadius: "999px", padding: "3px 10px", fontSize: "11px", fontWeight: 500 };
}

function ScoreBar({ value, max = 100, color = "#A5B4FC" }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{ height: "6px", flex: 1, borderRadius: "999px", backgroundColor: "rgba(255,255,255,0.08)" }}>
        <div style={{ height: "6px", borderRadius: "999px", backgroundColor: color, width: `${pct}%` }} />
      </div>
      <span style={{ width: "32px", flexShrink: 0, textAlign: "right", fontSize: "12px", fontWeight: 600, color: "#FFFFFF" }}>{value}</span>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "#303030",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "16px",
  padding: "20px",
};

export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = await params;
  const supabase = await createClient();

  const [
    { data: personData },
    { data: assignmentData },
    { data: membershipData },
    { data: scoreData },
  ] = await Promise.all([
    supabase
      .from("people")
      .select("*, companies(name, domain, linkedin_company_url, industry, employee_count)")
      .eq("id", personId)
      .maybeSingle(),
    supabase
      .from("lead_assignments")
      .select(`
        id, status, rotation_round, assigned_at, updated_at,
        clients(name),
        campaigns(name, type),
        sender_profiles(full_name),
        audiences(name),
        connection_status(state, requested_at, accepted_at, withdrawn_at)
      `)
      .eq("person_id", personId)
      .order("assigned_at", { ascending: false }),
    supabase
      .from("audience_members")
      .select(`
        id, qualify_status, qualify_reason, qualify_source, created_at, raw,
        audiences(id, name, client_id, clients(name))
      `)
      .eq("person_id", personId)
      .order("created_at", { ascending: false }),
    supabase
      .from("lead_scores")
      .select("*")
      .eq("person_id", personId)
      .order("scored_at", { ascending: false })
      .limit(1),
  ]);

  if (!personData) notFound();

  const person = personData as any;
  const company = first<any>(person.companies);
  const assignments = (assignmentData ?? []) as any[];
  const memberships = (membershipData ?? []) as any[];
  const bestScore = first<any>(scoreData ?? []);

  const bestMember = memberships.find((m) => m.raw?.linkedin?.enrichment_status === "enriched") ?? memberships[0];
  const li = bestMember?.raw?.linkedin ?? null;
  const aiFit = bestMember?.raw?.ai_fit ?? null;
  const provenance = bestMember?.raw?.provenance ?? null;
  const companyEnrich = bestMember?.raw?.company_enrichment ?? null;

  const name = person.full_name || `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() || "—";
  const initialsRaw = (person.first_name?.[0] ?? "") + (person.last_name?.[0] ?? "");
  const initials = initialsRaw || (name[0]?.toUpperCase() ?? "?");

  return (
    <div>
      <Link href="/people" style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", textDecoration: "none", display: "inline-block", marginBottom: "16px" }}>
        ← People
      </Link>

      {/* Header */}
      <div style={{ marginTop: "4px", display: "flex", alignItems: "flex-start", gap: "20px" }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          {li?.has_profile_photo && li?.profile_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={li.profile_photo_url}
              alt={name}
              referrerPolicy="no-referrer"
              style={{ width: "64px", height: "64px", borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.12)" }}
            />
          ) : (
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", backgroundColor: "#3B3B3B", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: 600, color: "#FFFFFF" }}>
              {initials}
            </div>
          )}
          {li?.activity_score != null && (
            <span style={{ position: "absolute", bottom: "-4px", right: "-4px", borderRadius: "999px", backgroundColor: "#FFCC00", padding: "2px 6px", fontSize: "10px", fontWeight: 700, color: "#272727" }}>
              {li.activity_score}
            </span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "8px" }}>
            <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#FFFFFF" }}>{name}</h1>
            {bestScore?.priority && (
              <span style={tierBadge(bestScore.priority)}>{bestScore.priority.replace("_", " ")}</span>
            )}
            {aiFit?.decision_maker_signal && (
              <span style={{ ...tierBadge("tier_2"), fontSize: "11px" }}>DM: {aiFit.decision_maker_signal}</span>
            )}
          </div>
          <p style={{ marginTop: "2px", fontSize: "14px", color: "#BDBDBD" }}>{person.title ?? "—"}</p>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)" }}>
            {company?.name ?? "—"}
            {company?.domain && <span style={{ marginLeft: "6px", fontFamily: "monospace", fontSize: "11px" }}>{company.domain}</span>}
          </p>
          <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
            {person.linkedin_url && (
              <a href={person.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ color: "#A5B4FC", textDecoration: "none" }}>
                LinkedIn ↗
              </a>
            )}
            {person.email && <span>{person.email}</span>}
            {li?.connections != null && <span>{li.connections.toLocaleString()} konekcija</span>}
            {li?.has_200_plus_connections && <span style={{ color: "#86EFAC" }}>200+ ✓</span>}
            {li?.active_last_30_days && <span style={{ color: "#86EFAC" }}>Aktivan (30d) ✓</span>}
            {li?.posted_last_30_days && <span style={{ color: "#A5B4FC" }}>Postuje ✓</span>}
          </div>
        </div>

        {bestScore && (
          <div style={{ ...cardStyle, flexShrink: 0, textAlign: "center", padding: "16px 24px" }}>
            <div style={{ fontSize: "36px", fontWeight: 700, color: "#FFFFFF" }}>{bestScore.fit_score ?? "—"}</div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>Fit score</div>
          </div>
        )}
      </div>

      {/* Main grid */}
      <div style={{ marginTop: "24px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }}>
        {/* LinkedIn enrichment */}
        <section style={cardStyle}>
          <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", marginBottom: "16px" }}>LinkedIn enrichment</p>
          {li ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
              {li.headline && (
                <p style={{ fontWeight: 600, color: "#FFFFFF" }}>{li.headline}</p>
              )}
              {li.about && (
                <p style={{ fontSize: "12px", lineHeight: "1.6", color: "#BDBDBD", display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>{li.about}</p>
              )}
              <div>
                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginBottom: "6px" }}>Activity score</p>
                <ScoreBar value={li.activity_score ?? 0} color="#A5B4FC" />
              </div>
              {aiFit?.linkedin_fit_signals?.length > 0 && (
                <div>
                  <p style={{ marginBottom: "6px", fontSize: "11px", fontWeight: 600, color: "#86EFAC" }}>Pozitivni signali</p>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "3px" }}>
                    {(aiFit.linkedin_fit_signals as string[]).map((s, i) => (
                      <li key={i} style={{ fontSize: "12px", color: "#BDBDBD" }}>✓ {s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {aiFit?.linkedin_red_flags?.length > 0 && (
                <div>
                  <p style={{ marginBottom: "6px", fontSize: "11px", fontWeight: 600, color: "#F87171" }}>Red flags</p>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "3px" }}>
                    {(aiFit.linkedin_red_flags as string[]).map((s, i) => (
                      <li key={i} style={{ fontSize: "12px", color: "#BDBDBD" }}>✗ {s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>Nema LinkedIn enrichmenta.</p>
          )}
        </section>

        {/* Company */}
        <section style={cardStyle}>
          <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", marginBottom: "16px" }}>Kompanija</p>
          {(company || companyEnrich) ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
              <p style={{ fontWeight: 600, color: "#FFFFFF" }}>{companyEnrich?.name ?? company?.name ?? "—"}</p>
              {(companyEnrich?.industry ?? company?.industry) && (
                <p style={{ fontSize: "12px", color: "#BDBDBD" }}>{companyEnrich?.industry ?? company.industry}</p>
              )}
              {(companyEnrich?.company_size ?? company?.employee_count) && (
                <p style={{ fontSize: "12px", color: "#BDBDBD" }}>
                  Veličina: {companyEnrich?.company_size ?? `${company.employee_count} zaposlenih`}
                </p>
              )}
              {companyEnrich?.headquarters && (
                <p style={{ fontSize: "12px", color: "#BDBDBD" }}>📍 {companyEnrich.headquarters}</p>
              )}
              {companyEnrich?.about && (
                <p style={{ marginTop: "8px", fontSize: "12px", lineHeight: "1.6", color: "#BDBDBD", display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>{companyEnrich.about}</p>
              )}
              {companyEnrich?.website && (
                <a href={companyEnrich.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "#A5B4FC", textDecoration: "none" }}>
                  {companyEnrich.website} ↗
                </a>
              )}
              {company?.linkedin_company_url && (
                <a href={company.linkedin_company_url} target="_blank" rel="noopener noreferrer" style={{ display: "block", fontSize: "12px", color: "#A5B4FC", textDecoration: "none" }}>
                  LinkedIn kompanija ↗
                </a>
              )}
            </div>
          ) : (
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>Nema podataka o kompaniji.</p>
          )}
        </section>

        {/* AI fit */}
        <section style={cardStyle}>
          <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", marginBottom: "16px" }}>AI fit score</p>
          {bestScore ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                  <span>ICP fit</span><span>{bestScore.icp_fit_score ?? "—"}/40</span>
                </div>
                <ScoreBar value={bestScore.icp_fit_score ?? 0} max={40} color="#818CF8" />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                  <span>Signal</span><span>{bestScore.signal_strength_score ?? "—"}/35</span>
                </div>
                <ScoreBar value={bestScore.signal_strength_score ?? 0} max={35} color="#A78BFA" />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                  <span>Engagement</span><span>{bestScore.engagement_score ?? "—"}/25</span>
                </div>
                <ScoreBar value={bestScore.engagement_score ?? 0} max={25} color="#A5B4FC" />
              </div>
              {aiFit?.role_fit_notes && (
                <p style={{ paddingTop: "4px", fontSize: "12px", lineHeight: "1.6", color: "#BDBDBD" }}>{aiFit.role_fit_notes}</p>
              )}
              {bestScore.reasoning && (
                <details style={{ cursor: "pointer" }}>
                  <summary style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>AI reasoning</summary>
                  <p style={{ marginTop: "6px", fontSize: "12px", lineHeight: "1.6", color: "#BDBDBD" }}>{bestScore.reasoning}</p>
                </details>
              )}
              {bestScore.personalization_sentence && (
                <div style={{ backgroundColor: "rgba(255,204,0,0.08)", border: "1px solid rgba(255,204,0,0.15)", borderRadius: "10px", padding: "10px 14px", fontSize: "12px", lineHeight: "1.6", color: "#BDBDBD" }}>
                  <span style={{ fontWeight: 600, color: "#FFCC00" }}>Personalizacija: </span>
                  {bestScore.personalization_sentence}
                </div>
              )}
            </div>
          ) : (
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>Lead još nije scorovan.</p>
          )}

          {provenance && (
            <div style={{ marginTop: "16px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "12px" }}>
              <p style={{ marginBottom: "8px", fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.35)" }}>Enrichment trail</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {([
                  ["FC", provenance.firecrawl_website],
                  ["BDp", provenance.brightdata_person],
                  ["BDc", provenance.brightdata_company],
                  ["AI", provenance.ai_qualify],
                ] as [string, string | null | undefined][]).map(([label, status]) => (
                  <span
                    key={label}
                    title={status ?? "skipped"}
                    style={{
                      borderRadius: "6px",
                      padding: "2px 6px",
                      fontFamily: "monospace",
                      fontSize: "10px",
                      fontWeight: 600,
                      backgroundColor: status === "ok" || status === "enriched"
                        ? "rgba(134,239,172,0.12)"
                        : status === "no_content" || status === "no_data" || status === "error"
                        ? "rgba(239,68,68,0.08)"
                        : "rgba(255,255,255,0.06)",
                      color: status === "ok" || status === "enriched"
                        ? "#86EFAC"
                        : status === "no_content" || status === "no_data" || status === "error"
                        ? "#F87171"
                        : "rgba(255,255,255,0.35)",
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Assignment history */}
      <section style={{ marginTop: "24px" }}>
        <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", marginBottom: "16px" }}>
          Istorija dodela ({assignments.length})
        </p>
        {assignments.length > 0 ? (
          <div style={{ borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
            <table style={{ minWidth: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#1E1E1E" }}>
                  {["Klijent", "Kampanja", "Sender", "Status", "Konekcija", "Rot.", "Dodeljeno"].map((h) => (
                    <th key={h} style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", padding: "12px 16px", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => {
                  const client = first<any>(a.clients);
                  const campaign = first<any>(a.campaigns);
                  const sender = first<any>(a.sender_profiles);
                  const conn = first<any>(a.connection_status);
                  const connState = conn?.state ?? "not_sent";
                  return (
                    <tr key={a.id} style={{ backgroundColor: "#303030", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: "#FFFFFF", whiteSpace: "nowrap" }}>
                        {client ? (
                          <Link href={`/clients/${first<any>(a.clients)?.id ?? ""}`} style={{ color: "#FFFFFF", textDecoration: "none" }}>
                            {client.name}
                          </Link>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#BDBDBD", whiteSpace: "nowrap" }}>
                        <span style={{ marginRight: "4px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", color: campaign?.type === "follow_up" ? "#A5B4FC" : "rgba(255,255,255,0.35)" }}>
                          {campaign?.type ?? ""}
                        </span>
                        {campaign?.name ?? "—"}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#BDBDBD", whiteSpace: "nowrap" }}>{sender?.full_name ?? "—"}</td>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        <span style={statusBadge(a.status)}>{a.status.replace(/_/g, " ")}</span>
                      </td>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap", fontSize: "12px" }}>
                        <span style={{ color: connColor(connState) }}>{CONN_LABELS[connState] ?? connState}</span>
                        {conn?.accepted_at && <span style={{ marginLeft: "4px", color: "rgba(255,255,255,0.35)" }}>{fmtDate(conn.accepted_at)}</span>}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center", color: "#BDBDBD", whiteSpace: "nowrap" }}>{a.rotation_round}</td>
                      <td style={{ padding: "12px 16px", fontSize: "12px", color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>{fmtDate(a.assigned_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ ...cardStyle, textAlign: "center", fontSize: "14px", color: "rgba(255,255,255,0.35)" }}>
            Ovaj lead još nije dodeljen ni jednom klijentu.
          </p>
        )}
      </section>

      {/* Audience memberships */}
      <section style={{ marginTop: "24px" }}>
        <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", marginBottom: "16px" }}>
          Audience istorija ({memberships.length})
        </p>
        {memberships.length > 0 ? (
          <div style={{ borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
            <table style={{ minWidth: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#1E1E1E" }}>
                  {["Audience", "Klijent", "Qualify status", "Razlog", "Uvezen"].map((h) => (
                    <th key={h} style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", padding: "12px 16px", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {memberships.map((m) => {
                  const aud = first<any>(m.audiences);
                  const client = first<any>(aud?.clients);
                  return (
                    <tr key={m.id} style={{ backgroundColor: "#303030", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: "#FFFFFF", whiteSpace: "nowrap" }}>
                        {aud ? (
                          <Link
                            href={`/clients/${aud.client_id}/audiences/${aud.id}/members`}
                            style={{ color: "#FFFFFF", textDecoration: "none" }}
                          >
                            {aud.name}
                          </Link>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#BDBDBD", whiteSpace: "nowrap" }}>{client?.name ?? "—"}</td>
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        <span style={qualifyBadge(m.qualify_status)}>
                          {QUALIFY_LABELS[m.qualify_status] ?? m.qualify_status}
                        </span>
                      </td>
                      <td style={{ maxWidth: "280px", padding: "12px 16px", fontSize: "12px", color: "#BDBDBD" }}>
                        <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>{m.qualify_reason ?? "—"}</span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "12px", color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>{fmtDate(m.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ ...cardStyle, textAlign: "center", fontSize: "14px", color: "rgba(255,255,255,0.35)" }}>
            Ovaj lead nije importovan ni u jedan audience.
          </p>
        )}
      </section>
    </div>
  );
}
