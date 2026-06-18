import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  updateSenderProfileAction,
  toggleSenderProfileActive,
} from "@/app/actions/senderProfiles";
import SenderProfileForm from "../SenderProfileForm";
import type { SenderProfile, Campaign } from "@/lib/types";

function CampaignStatusBadge({ status }: { status: string }) {
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
        fontSize: "11px",
        fontWeight: 500,
        textTransform: "capitalize",
      }}
    >
      {status}
    </span>
  );
}

export default async function SenderProfileDetailPage({
  params,
}: {
  params: Promise<{ id: string; profileId: string }>;
}) {
  const { id, profileId } = await params;
  const supabase = await createClient();
  const [{ data }, { data: campaignsData }] = await Promise.all([
    supabase.from("sender_profiles").select("*").eq("id", profileId).eq("client_id", id).maybeSingle(),
    supabase.from("campaigns").select("id, name, type, status, personalization_level").eq("sender_profile_id", profileId).order("created_at", { ascending: false }),
  ]);

  if (!data) notFound();
  const profile = data as SenderProfile;
  const campaigns = (campaignsData ?? []) as Pick<Campaign, "id" | "name" | "type" | "status" | "personalization_level">[];

  const update = updateSenderProfileAction.bind(null, profile.id, id);
  const toggle = toggleSenderProfileActive.bind(
    null,
    profile.id,
    id,
    !profile.is_active
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#272727", padding: "32px" }}>
      <Link
        href={`/clients/${id}/profiles`}
        style={{
          fontSize: "12px",
          color: "rgba(255,255,255,0.4)",
          textDecoration: "none",
          display: "inline-block",
          marginBottom: "12px",
        }}
      >
        ← Sender profiles
      </Link>

      <div className="flex items-center justify-between" style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              height: "10px",
              width: "10px",
              borderRadius: "50%",
              backgroundColor: profile.is_active ? "#86EFAC" : "rgba(255,255,255,0.2)",
              flexShrink: 0,
            }}
          />
          <h1 className="text-3xl font-bold text-white">{profile.full_name}</h1>
        </div>
        <form action={toggle}>
          <button
            type="submit"
            style={{
              backgroundColor: "transparent",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.4)",
              borderRadius: "12px",
              padding: "10px 20px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            {profile.is_active ? "Deactivate" : "Activate"}
          </button>
        </form>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "32px",
        }}
      >
        <section>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.35)",
              marginBottom: "16px",
            }}
          >
            Details
          </p>
          <SenderProfileForm
            action={update}
            defaults={{
              full_name: profile.full_name,
              linkedin_url: profile.linkedin_url,
              heyreach_account_id: profile.heyreach_account_id,
              daily_limit: profile.daily_limit,
              notes: profile.notes,
            }}
            submitLabel="Save changes"
          />
        </section>

        <section>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.35)",
              marginBottom: "16px",
            }}
          >
            Campaigns ({campaigns.length})
          </p>
          {campaigns.length === 0 ? (
            <p style={{ fontSize: "14px", color: "#BDBDBD" }}>
              No campaigns assigned to this sender.{" "}
              <Link
                href={`/clients/${id}/campaigns/new`}
                style={{ color: "#FFCC00", textDecoration: "underline" }}
              >
                Create a campaign
              </Link>{" "}
              and select this sender profile.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {campaigns.map((c) => (
                <Link
                  key={c.id}
                  href={`/clients/${id}/campaigns/${c.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "#303030",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "12px",
                    padding: "14px 16px",
                    fontSize: "14px",
                    textDecoration: "none",
                    transition: "background-color 0.15s",
                  }}
                  
                  
                >
                  <div>
                    <p style={{ fontWeight: 500, color: "#FFFFFF", marginBottom: "3px" }}>{c.name}</p>
                    <p style={{ fontSize: "12px", color: "#BDBDBD", textTransform: "capitalize" }}>
                      {c.type.replace("_", "-")} · {c.personalization_level}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <CampaignStatusBadge status={c.status} />
                    <span style={{ color: "rgba(255,255,255,0.35)" }}>→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
