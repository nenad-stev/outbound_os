import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createCampaignAction } from "@/app/actions/campaigns";
import CampaignForm from "../CampaignForm";
import type { Client, Campaign } from "@/lib/types";

export default async function NewCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: clientData }, { data: existing }, { data: senders }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase.from("campaigns").select("id, name").eq("client_id", id).order("created_at"),
    supabase.from("sender_profiles").select("id, full_name").eq("client_id", id).eq("is_active", true).order("full_name"),
  ]);

  if (!clientData) notFound();
  const client = clientData as Client;
  const parentOptions = (existing ?? []) as Pick<Campaign, "id" | "name">[];
  const senderOptions = (senders ?? []) as { id: string; full_name: string }[];

  const action = createCampaignAction.bind(null, client.id);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#272727", padding: "32px" }}>
      <Link
        href={`/clients/${id}/campaigns`}
        style={{
          fontSize: "12px",
          color: "rgba(255,255,255,0.4)",
          textDecoration: "none",
          display: "inline-block",
          marginBottom: "12px",
        }}
      >
        ← Campaigns
      </Link>
      <h1 className="text-3xl font-bold text-white" style={{ marginBottom: "4px" }}>
        New campaign
      </h1>
      <p style={{ fontSize: "14px", color: "#BDBDBD", marginBottom: "32px" }}>
        For client <span style={{ color: "#FFFFFF", fontWeight: 500 }}>{client.name}</span>.
      </p>
      <div style={{ maxWidth: "720px" }}>
        <CampaignForm action={action} parentOptions={parentOptions} senderOptions={senderOptions} submitLabel="Create campaign" />
      </div>
    </div>
  );
}
