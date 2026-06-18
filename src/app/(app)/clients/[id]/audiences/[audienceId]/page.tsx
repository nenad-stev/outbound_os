import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StartPipelineButton from "./StartPipelineButton";

export default async function AudiencePreviewPage({
  params,
}: {
  params: Promise<{ id: string; audienceId: string }>;
}) {
  const { id, audienceId } = await params;
  const supabase = await createClient();

  const [{ data: audienceData }, { data: membersData }, { data: counts }] = await Promise.all([
    supabase
      .from("audiences")
      .select("*, campaigns(name, type), icp_profiles(name), sender_profiles(full_name)")
      .eq("id", audienceId)
      .eq("client_id", id)
      .maybeSingle(),
    supabase
      .from("audience_members")
      .select("id, raw, qualify_status, qualify_source, qualify_reason")
      .eq("audience_id", audienceId)
      .order("id")
      .limit(10),
    supabase
      .from("audience_members")
      .select("qualify_status")
      .eq("audience_id", audienceId),
  ]);

  if (!audienceData) notFound();
  const audience = audienceData as any;
  const preview = (membersData ?? []) as any[];
  const allMembers = (counts ?? []) as any[];

  const statusCounts = allMembers.reduce(
    (acc: Record<string, number>, m: any) => {
      acc[m.qualify_status] = (acc[m.qualify_status] ?? 0) + 1;
      return acc;
    },
    {}
  );

  const total = allMembers.length;
  const pending = statusCounts["pending"] ?? 0;
  const qualified = statusCounts["qualified"] ?? 0;
  const disqualified = statusCounts["disqualified"] ?? 0;
  const noData = statusCounts["not_able_to_qualify"] ?? 0;
  const pipelineStarted = pending < total;

  const tableHeaders = ["Name", "Title", "Company", "Domain", "LinkedIn", "Status"];

  function qualifyStatusStyle(status: string): React.CSSProperties {
    if (status === "qualified") return { backgroundColor: "rgba(134,239,172,0.12)", color: "#86EFAC" };
    if (status === "disqualified") return { backgroundColor: "rgba(239,68,68,0.12)", color: "#F87171" };
    if (status === "not_able_to_qualify") return { backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" };
    return { backgroundColor: "rgba(255,255,255,0.08)", color: "#BDBDBD" };
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#272727", padding: "32px" }}>
      <Link
        href={`/clients/${id}/audiences`}
        style={{
          fontSize: "12px",
          color: "rgba(255,255,255,0.4)",
          textDecoration: "none",
          display: "inline-block",
          marginBottom: "12px",
        }}
      >
        ← Audiences
      </Link>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "24px" }}>
        <div>
          <h1 className="text-3xl font-bold text-white" style={{ marginBottom: "6px" }}>
            {audience.name}
          </h1>
          <p style={{ fontSize: "14px", color: "#BDBDBD" }}>
            {total} leads
            {audience.campaigns?.name ? ` · ${audience.campaigns.name}` : ""}
            {audience.icp_profiles?.name ? ` · ICP: ${audience.icp_profiles.name}` : ""}
            {audience.sender_profiles?.full_name ? ` · ${audience.sender_profiles.full_name}` : ""}
          </p>
        </div>

        {!pipelineStarted && (
          <StartPipelineButton audienceId={audienceId} clientId={id} total={total} />
        )}
      </div>

      {pipelineStarted && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "12px",
            marginBottom: "32px",
          }}
        >
          {[
            { label: "Pending", value: pending, color: "#BDBDBD" },
            { label: "Qualified", value: qualified, color: "#86EFAC" },
            { label: "Disqualified", value: disqualified, color: "#F87171" },
            { label: "No data", value: noData, color: "rgba(255,255,255,0.35)" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                backgroundColor: "#303030",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "16px",
                padding: "20px",
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: "28px", fontWeight: 700, color: s.color }}>{s.value}</p>
              <p style={{ marginTop: "4px", fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.35)",
            }}
          >
            Preview — first {preview.length} leads
          </p>
          <Link
            href={`/clients/${id}/audiences/${audienceId}/members`}
            style={{
              fontSize: "13px",
              color: "#FFCC00",
              textDecoration: "underline",
            }}
          >
            View all →
          </Link>
        </div>
        <div
          style={{
            borderRadius: "16px",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
              <thead>
                <tr style={{ backgroundColor: "#1E1E1E" }}>
                  {tableHeaders.map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontSize: "11px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "rgba(255,255,255,0.35)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((m, i) => {
                  const r = m.raw as any;
                  return (
                    <tr
                      key={m.id}
                      style={{
                        backgroundColor: "#303030",
                        borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none",
                        transition: "background-color 0.15s",
                      }}
                      
                      
                    >
                      <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 500, color: "#FFFFFF", whiteSpace: "nowrap" }}>
                        {r.full_name || `${r.first_name} ${r.last_name}`.trim() || "—"}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", color: "#BDBDBD", maxWidth: "160px" }}>
                        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.title ?? "—"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", color: "#BDBDBD", maxWidth: "140px" }}>
                        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.company_name ?? "—"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "12px", color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>
                        {r.company_domain ?? "—"}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "12px" }}>
                        {r.linkedin_url ? (
                          <a
                            href={r.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "#A5B4FC", textDecoration: "none" }}
                          >
                            LinkedIn ↗
                          </a>
                        ) : (
                          <span style={{ color: "rgba(255,255,255,0.35)" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            ...qualifyStatusStyle(m.qualify_status),
                            borderRadius: "999px",
                            padding: "3px 10px",
                            fontSize: "12px",
                            fontWeight: 500,
                          }}
                        >
                          {m.qualify_status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {total > 10 && (
          <p style={{ marginTop: "8px", fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
            Showing 10 of {total} leads.
          </p>
        )}
      </div>
    </div>
  );
}
