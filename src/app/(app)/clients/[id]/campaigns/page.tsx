import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Client, Campaign } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  initial: "Initial",
  follow_up: "Follow-up",
  ad_hoc: "Ad-hoc",
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
      }}
    >
      {status}
    </span>
  );
}

export default async function CampaignsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: clientData }, { data: campaigns }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("campaigns")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!clientData) notFound();
  const client = clientData as Client;
  const list = (campaigns ?? []) as Campaign[];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#272727", padding: "32px" }}>
      <Link
        href={`/clients/${id}`}
        style={{
          fontSize: "12px",
          color: "rgba(255,255,255,0.4)",
          textDecoration: "none",
          display: "inline-block",
          marginBottom: "12px",
        }}
      >
        ← {client.name}
      </Link>

      <div className="flex items-center justify-between" style={{ marginBottom: "8px" }}>
        <h1 className="text-3xl font-bold text-white">Campaigns</h1>
        <Link
          href={`/clients/${id}/campaigns/new`}
          style={{
            backgroundColor: "#FFCC00",
            color: "#272727",
            fontWeight: 600,
            borderRadius: "12px",
            padding: "10px 20px",
            fontSize: "14px",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          + New campaign
        </Link>
      </div>

      {list.length === 0 ? (
        <p style={{ marginTop: "32px", fontSize: "14px", color: "#BDBDBD" }}>
          No campaigns yet.{" "}
          <Link
            href={`/clients/${id}/campaigns/new`}
            style={{ color: "#FFCC00", textDecoration: "underline" }}
          >
            Create the first one.
          </Link>
        </p>
      ) : (
        <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {list.map((c) => (
            <Link
              key={c.id}
              href={`/clients/${id}/campaigns/${c.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#303030",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "16px",
                padding: "16px 20px",
                textDecoration: "none",
                transition: "background-color 0.15s",
              }}
              
              
            >
              <div>
                <p style={{ fontSize: "14px", fontWeight: 500, color: "#FFFFFF", marginBottom: "4px" }}>
                  {c.name}
                </p>
                <p style={{ fontSize: "12px", color: "#BDBDBD" }}>
                  {TYPE_LABELS[c.type]} · {c.personalization_level} personalization
                  {c.followup_delay_days ? ` · ${c.followup_delay_days}d follow-up` : ""}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <StatusBadge status={c.status} />
                <span style={{ color: "rgba(255,255,255,0.35)" }}>→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
