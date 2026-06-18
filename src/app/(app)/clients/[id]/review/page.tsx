import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ReviewQueue from "./ReviewQueue";

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
      .select("id, name, campaigns(name, heyreach_campaign_id), sender_profiles(heyreach_account_id)")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!clientData) notFound();

  const audiences = (audiencesData ?? []) as any[];
  const selectedAudience = audiences.find((a) => a.id === selectedAudienceId) ?? audiences[0];

  let leads: any[] = [];
  if (selectedAudience) {
    const { data } = await supabase
      .from("audience_members")
      .select("id, audience_id, qualify_status, qualify_source, qualify_reason, review_status, raw")
      .eq("audience_id", selectedAudience.id)
      .eq("qualify_status", "qualified")
      .order("id");
    leads = (data ?? []) as any[];
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
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {audiences.map((a) => (
                <Link
                  key={a.id}
                  href={`/clients/${id}/review?audienceId=${a.id}`}
                  style={selectedAudience?.id === a.id
                    ? { backgroundColor: "#FFCC00", color: "#272727", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", textDecoration: "none", display: "block", fontWeight: 600 }
                    : { backgroundColor: "rgba(255,255,255,0.04)", color: "#BDBDBD", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", textDecoration: "none", display: "block" }
                  }
                >
                  {a.name}
                  {a.campaigns?.name && (
                    <p style={{ marginTop: "2px", fontSize: "11px", color: selectedAudience?.id === a.id ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: "2px 0 0" }}>
                      {a.campaigns.name}
                    </p>
                  )}
                </Link>
              ))}
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
                />
              )
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
