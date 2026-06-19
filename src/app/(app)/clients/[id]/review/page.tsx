import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ReviewQueue from "./ReviewQueue";

function StatPill({ label, color, active }: { label: string; color: string; active: boolean }) {
  return (
    <span style={{
      fontSize: "10px",
      fontWeight: 500,
      padding: "1px 7px",
      borderRadius: "999px",
      color: active ? "#272727" : color,
      backgroundColor: active ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.06)",
      whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

export default async function ClientReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ audienceId?: string }>;
}) {
  const { id } = await params;
  const { audienceId: selectedAudienceId } = await searchParams;
  const supabase = await createClient();

  const [{ data: clientData }, { data: audiencesData }] = await Promise.all([
    supabase.from("clients").select("id, name").eq("id", id).maybeSingle(),
    supabase
      .from("audiences")
      .select("id, name, source_meta, campaign_id, campaigns(name, heyreach_campaign_id), sender_profiles(full_name, heyreach_account_id)")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!clientData) notFound();

  const audiences = (audiencesData ?? []) as any[];
  const selectedAudience = audiences.find((a) => a.id === selectedAudienceId) ?? audiences[0];

  // Per-audience qualified counts + review-status breakdown for the sidebar cards.
  type Stat = { total: number; pending: number; approved: number; rejected: number; pushed: number };
  const statsByAudience: Record<string, Stat> = {};
  if (audiences.length) {
    const { data: countRows } = await supabase
      .from("audience_members")
      .select("audience_id, review_status")
      .in("audience_id", audiences.map((a) => a.id))
      .eq("qualify_status", "qualified");
    for (const row of (countRows ?? []) as any[]) {
      const s = (statsByAudience[row.audience_id] ??= { total: 0, pending: 0, approved: 0, rejected: 0, pushed: 0 });
      s.total++;
      if (row.review_status === "approved") s.approved++;
      else if (row.review_status === "rejected") s.rejected++;
      else if (row.review_status === "pushed") s.pushed++;
      else s.pending++;
    }
  }

  let leads: any[] = [];
  let sequenceSteps: any[] = [];
  if (selectedAudience) {
    const [{ data: leadRows }, stepRes] = await Promise.all([
      supabase
        .from("audience_members")
        .select("id, audience_id, qualify_status, qualify_source, qualify_reason, review_status, raw")
        .eq("audience_id", selectedAudience.id)
        .eq("qualify_status", "qualified")
        .order("id"),
      selectedAudience.campaign_id
        ? supabase
            .from("sequence_steps")
            .select("step_order, channel, template_text, delay_days")
            .eq("campaign_id", selectedAudience.campaign_id)
            .order("step_order")
        : Promise.resolve({ data: [] as any[] }),
    ]);
    leads = (leadRows ?? []) as any[];
    sequenceSteps = (stepRes.data ?? []) as any[];
  }

  // HeyReach push readiness — surfaced as a pre-push warning in the queue.
  const heyreachIssues: string[] = [];
  if (selectedAudience) {
    if (!selectedAudience.campaigns?.heyreach_campaign_id)
      heyreachIssues.push("Kampanja nema HeyReach campaign ID (Campaigns → settings).");
    if (!selectedAudience.sender_profiles?.heyreach_account_id)
      heyreachIssues.push("Sender profile nema HeyReach account ID (Senders → settings).");
  }
  return (
    <div>
      <Link href={`/clients/${id}`} style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", textDecoration: "none", display: "inline-block", marginBottom: "16px" }}>
        ← {clientData.name}
      </Link>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "8px 0 28px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#FFFFFF" }}>Review Queue</h1>
          <p style={{ fontSize: "14px", color: "#BDBDBD", marginTop: "4px" }}>{leads.length} qualified leadova</p>
        </div>
      </div>

      {audiences.length === 0 ? (
        <p style={{ padding: "32px", textAlign: "center", fontSize: "14px", color: "rgba(255,255,255,0.35)" }}>
          Nema audience-a za ovog klijenta.{" "}
          <Link href={`/clients/${id}/audiences/new`} style={{ color: "#FFCC00", textDecoration: "none" }}>
            Dodaj audience →
          </Link>
        </p>
      ) : (
        <div style={{ display: "flex", gap: "24px" }}>
          {/* Audience picker sidebar */}
          <div style={{ width: "224px", flexShrink: 0 }}>
            <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", marginBottom: "12px" }}>Audience</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {audiences.map((a) => {
                const active = selectedAudience?.id === a.id;
                const s = statsByAudience[a.id] ?? { total: 0, pending: 0, approved: 0, rejected: 0, pushed: 0 };
                const muted = active ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.4)";
                return (
                  <Link
                    key={a.id}
                    href={`/clients/${id}/review?audienceId=${a.id}`}
                    style={{
                      backgroundColor: active ? "#FFCC00" : "rgba(255,255,255,0.04)",
                      color: active ? "#272727" : "#BDBDBD",
                      borderRadius: "12px",
                      padding: "12px 14px",
                      textDecoration: "none",
                      display: "block",
                      border: active ? "1px solid #FFCC00" : "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <p style={{ fontSize: "13px", fontWeight: 600, margin: 0, overflowWrap: "anywhere", lineHeight: 1.3 }}>
                      {a.name}
                    </p>
                    {a.campaigns?.name && (
                      <p style={{ marginTop: "3px", fontSize: "11px", color: muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: "3px 0 0" }}>
                        {a.campaigns.name}
                      </p>
                    )}
                    <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: active ? "#272727" : "#FFFFFF" }}>
                        {s.total} qualified
                      </span>
                      {s.total > 0 && (
                        <span style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                          {s.pending > 0 && <StatPill active={active} color="#BDBDBD" label={`${s.pending} na čekanju`} />}
                          {s.approved > 0 && <StatPill active={active} color="#86EFAC" label={`${s.approved} approved`} />}
                          {s.pushed > 0 && <StatPill active={active} color="#A5B4FC" label={`${s.pushed} pushed`} />}
                          {s.rejected > 0 && <StatPill active={active} color="#F87171" label={`${s.rejected} rejected`} />}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Main content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {selectedAudience ? (
              leads.length === 0 ? (
                <div style={{ padding: "48px 0", textAlign: "center" }}>
                  <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.35)" }}>Nema qualified leadova u ovom audience-u.</p>
                  <p style={{ marginTop: "4px", fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>
                    Pokreni pipeline da bi se leadovi procesirali.
                  </p>
                  <Link
                    href={`/clients/${id}/audiences/${selectedAudience.id}`}
                    style={{ marginTop: "12px", display: "inline-block", fontSize: "13px", color: "#FFCC00", textDecoration: "none" }}
                  >
                    Idi na audience →
                  </Link>
                </div>
              ) : (
                <ReviewQueue
                  leads={leads}
                  clientId={id}
                  audienceId={selectedAudience.id}
                  campaignName={selectedAudience.campaigns?.name ?? selectedAudience.name}
                  initialBrief={(selectedAudience.source_meta as any)?.message_brief ?? ""}
                  sequenceSteps={sequenceSteps}
                  heyreachIssues={heyreachIssues}
                />
              )
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
