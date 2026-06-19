import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LaunchWizard from "./LaunchWizard";

export default async function LaunchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: clientData }, { data: campaignsData }, { data: sendersData }, { data: icpData }, { data: audiencesData }] =
    await Promise.all([
      supabase.from("clients").select("id, name").eq("id", id).maybeSingle(),
      supabase
        .from("campaigns")
        .select("id, name, heyreach_campaign_id, sender_profile_id, sequence_steps(id)")
        .eq("client_id", id)
        .neq("status", "archived")
        .order("created_at", { ascending: false }),
      supabase
        .from("sender_profiles")
        .select("id, full_name, heyreach_account_id")
        .eq("client_id", id)
        .eq("is_active", true)
        .order("rotation_order"),
      supabase.from("icp_profiles").select("id, name, is_default").eq("client_id", id).order("created_at"),
      supabase
        .from("audiences")
        .select("id, name, row_count, campaign_id")
        .eq("client_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  if (!clientData) notFound();

  const campaigns = ((campaignsData ?? []) as any[]).map((c) => ({
    id: c.id,
    name: c.name,
    heyreach_campaign_id: c.heyreach_campaign_id ?? null,
    sender_profile_id: c.sender_profile_id ?? null,
    step_count: Array.isArray(c.sequence_steps) ? c.sequence_steps.length : 0,
  }));
  const senders = ((sendersData ?? []) as any[]).map((s) => ({
    id: s.id,
    name: s.full_name,
    heyreach_account_id: s.heyreach_account_id ?? null,
  }));
  const icps = (icpData ?? []) as { id: string; name: string; is_default: boolean }[];
  const audiences = (audiencesData ?? []) as { id: string; name: string; row_count: number; campaign_id: string | null }[];

  return (
    <div>
      <Link href={`/clients/${id}`} style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", textDecoration: "none", display: "inline-block", marginBottom: "16px" }}>
        ← {clientData.name}
      </Link>
      <div style={{ margin: "8px 0 28px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#FFFFFF" }}>Pokreni kampanju</h1>
        <p style={{ fontSize: "14px", color: "#BDBDBD", marginTop: "4px" }}>
          Vođen proces: kampanja → identitet → publika → obrada → pregled i slanje.
        </p>
      </div>

      <LaunchWizard
        clientId={id}
        campaigns={campaigns}
        senders={senders}
        icps={icps}
        audiences={audiences}
      />
    </div>
  );
}
