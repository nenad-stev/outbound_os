import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MembersTable from "./MembersTable";

export default async function AudienceMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; audienceId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { id, audienceId } = await params;
  const { status } = await searchParams;

  const supabase = await createClient();

  const [{ data: audienceData }, { data: membersData }] = await Promise.all([
    supabase
      .from("audiences")
      .select("id, name, row_count, campaign_id, campaigns(name)")
      .eq("id", audienceId)
      .eq("client_id", id)
      .maybeSingle(),
    supabase
      .from("audience_members")
      .select("id, raw, qualify_status, qualify_source, qualify_reason")
      .eq("audience_id", audienceId)
      .order("id"),
  ]);

  if (!audienceData) notFound();
  const audience = audienceData as any;
  const allMembers = (membersData ?? []) as any[];

  let steps: any[] = [];
  if (audience.campaign_id) {
    const { data: stepData } = await supabase
      .from("sequence_steps")
      .select("step_order, channel, template_text, ai_instructions, delay_days")
      .eq("campaign_id", audience.campaign_id)
      .order("step_order");
    steps = (stepData ?? []) as any[];
  }

  const filtered = status ? allMembers.filter((m) => m.qualify_status === status) : allMembers;

  const counts = allMembers.reduce((acc: Record<string, number>, m: any) => {
    acc[m.qualify_status] = (acc[m.qualify_status] ?? 0) + 1;
    return acc;
  }, {});

  const tabs = [
    { key: "", label: "All", count: allMembers.length },
    { key: "qualified", label: "Qualified", count: counts["qualified"] ?? 0 },
    { key: "disqualified", label: "Disqualified", count: counts["disqualified"] ?? 0 },
    { key: "not_able_to_qualify", label: "No data", count: counts["not_able_to_qualify"] ?? 0 },
    { key: "pending", label: "Pending", count: counts["pending"] ?? 0 },
  ];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#272727", padding: "32px" }}>
      <Link
        href={`/clients/${id}/audiences/${audienceId}`}
        style={{
          fontSize: "12px",
          color: "rgba(255,255,255,0.4)",
          textDecoration: "none",
          display: "inline-block",
          marginBottom: "12px",
        }}
      >
        ← {audience.name}
      </Link>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
        <h1 className="text-3xl font-bold text-white">Leads</h1>
        <span style={{ fontSize: "13px", color: "#BDBDBD" }}>{allMembers.length} total</span>
      </div>

      <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginBottom: "20px" }}>
        Click a row for details, enrichment trail, and message preview.
      </p>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/clients/${id}/audiences/${audienceId}/members${t.key ? `?status=${t.key}` : ""}`}
            style={
              (status ?? "") === t.key
                ? {
                    backgroundColor: "#FFCC00",
                    color: "#272727",
                    fontWeight: 600,
                    borderRadius: "999px",
                    padding: "4px 14px",
                    fontSize: "12px",
                    textDecoration: "none",
                  }
                : {
                    backgroundColor: "rgba(255,255,255,0.06)",
                    color: "#BDBDBD",
                    borderRadius: "999px",
                    padding: "4px 14px",
                    fontSize: "12px",
                    textDecoration: "none",
                  }
            }
          >
            {t.label} ({t.count})
          </Link>
        ))}
      </div>

      <MembersTable members={filtered} steps={steps} />
    </div>
  );
}
