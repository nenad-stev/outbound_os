import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateCampaignAction, setCampaignStatus } from "@/app/actions/campaigns";
import CampaignForm from "../CampaignForm";
import type { Campaign, SequenceStep } from "@/lib/types";

const STATUS_TRANSITIONS: Record<string, { label: string; next: string }[]> = {
  draft:    [{ label: "Activate", next: "active" }],
  active:   [{ label: "Pause", next: "paused" }, { label: "Archive", next: "archived" }],
  paused:   [{ label: "Resume", next: "active" }, { label: "Archive", next: "archived" }],
  archived: [{ label: "Unarchive", next: "draft" }],
};

function StatusBadge({ status }: { status: string }) {
  const styles: React.CSSProperties =
    status === "active"
      ? { backgroundColor: "rgba(255,204,0,0.15)", color: "#FFCC00" }
      : status === "paused"
        ? { backgroundColor: "rgba(255,255,255,0.08)", color: "#BDBDBD" }
        : status === "archived"
          ? { backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }
          : { backgroundColor: "rgba(255,255,255,0.08)", color: "#BDBDBD" };

  return (
    <span
      style={{
        ...styles,
        borderRadius: "999px",
        padding: "3px 10px",
        fontSize: "12px",
        fontWeight: 500,
        textTransform: "capitalize",
      }}
    >
      {status}
    </span>
  );
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string; campaignId: string }>;
}) {
  const { id, campaignId } = await params;
  const supabase = await createClient();

  const [{ data: campaignData }, { data: stepsData }, { data: existingCampaigns }, { data: senders }] =
    await Promise.all([
      supabase.from("campaigns").select("*").eq("id", campaignId).eq("client_id", id).maybeSingle(),
      supabase.from("sequence_steps").select("*").eq("campaign_id", campaignId).order("step_order"),
      supabase.from("campaigns").select("id, name").eq("client_id", id).neq("id", campaignId).order("created_at"),
      supabase.from("sender_profiles").select("id, full_name").eq("client_id", id).eq("is_active", true).order("full_name"),
    ]);

  if (!campaignData) notFound();
  const campaign = campaignData as Campaign;
  const steps = (stepsData ?? []) as SequenceStep[];
  const parentOptions = (existingCampaigns ?? []) as Pick<Campaign, "id" | "name">[];
  const senderOptions = (senders ?? []) as { id: string; full_name: string }[];

  const update = updateCampaignAction.bind(null, campaign.id, id);
  const transitions = STATUS_TRANSITIONS[campaign.status] ?? [];

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

      <div className="flex items-center justify-between" style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h1 className="text-3xl font-bold text-white">{campaign.name}</h1>
          <StatusBadge status={campaign.status} />
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {transitions.map((t) => (
            <form key={t.next} action={setCampaignStatus.bind(null, campaign.id, id, t.next)}>
              <button
                type="submit"
                style={{
                  backgroundColor: "transparent",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#FFFFFF",
                  borderRadius: "12px",
                  padding: "10px 20px",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            </form>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: "720px" }}>
        <CampaignForm
          action={update}
          defaults={campaign}
          defaultSteps={steps}
          parentOptions={parentOptions}
          senderOptions={senderOptions}
          submitLabel="Save changes"
        />
      </div>
    </div>
  );
}
