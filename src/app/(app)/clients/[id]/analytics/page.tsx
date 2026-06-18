import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import TrendChart from "./TrendChart";
import PostTable from "./PostTable";

function first<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (!client) notFound();

  const { data: postsRaw } = await supabase
    .from("content_posts")
    .select(`
      id, topic, post_type, published_at,
      impressions, likes, comments, shares,
      sender_profiles(full_name)
    `)
    .eq("client_id", id)
    .order("published_at", { ascending: false });

  const posts = (postsRaw ?? []).map((p: any) => ({
    id:                  p.id as string,
    topic:               p.topic as string | null,
    post_type:           p.post_type as string,
    published_at:        p.published_at as string | null,
    impressions:         (p.impressions ?? 0) as number,
    likes:               (p.likes       ?? 0) as number,
    comments:            (p.comments    ?? 0) as number,
    shares:              (p.shares      ?? 0) as number,
    sender_profile_name: (first<any>(p.sender_profiles)?.full_name ?? null) as string | null,
  }));

  const published = posts.filter((p) => p.published_at);

  const totals = published.reduce(
    (acc, p) => ({
      impressions: acc.impressions + p.impressions,
      likes:       acc.likes       + p.likes,
      comments:    acc.comments    + p.comments,
      shares:      acc.shares      + p.shares,
    }),
    { impressions: 0, likes: 0, comments: 0, shares: 0 }
  );

  const avgEngRate = totals.impressions > 0
    ? `${((totals.likes + totals.comments + totals.shares) / totals.impressions * 100).toFixed(1)}%`
    : "—";

  return (
    <div>
      {/* Header */}
      <Link
        href={`/clients/${id}`}
        style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", textDecoration: "none", display: "inline-block", marginBottom: "16px" }}
      >
        ← {client.name}
      </Link>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#FFFFFF", margin: 0 }}>Analytics</h1>
          <p style={{ fontSize: "13px", color: "#BDBDBD", marginTop: "4px" }}>
            LinkedIn post performanse — {client.name}
          </p>
        </div>
        <Link
          href={`/clients/${id}/content`}
          style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", textDecoration: "none", marginTop: "4px" }}
        >
          Svi postovi →
        </Link>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "32px" }}>
        {[
          { label: "Postova", value: published.length.toString(), color: "#FFFFFF" },
          { label: "Impresije", value: totals.impressions.toLocaleString("sr-RS"), color: "#FFCC00" },
          { label: "Lajkovi", value: totals.likes.toLocaleString("sr-RS"), color: "#86EFAC" },
          { label: "Komentari", value: totals.comments.toLocaleString("sr-RS"), color: "#A5B4FC" },
          { label: "Eng. Rate", value: avgEngRate, color: "#F9A8D4" },
        ].map((kpi) => (
          <div key={kpi.label} style={{ backgroundColor: "#303030", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "18px 20px" }}>
            <div style={{ fontSize: "28px", fontWeight: 700, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
            <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", marginTop: "8px" }}>
              {kpi.label}
            </div>
          </div>
        ))}
      </div>

      {/* Trend chart */}
      <div style={{ backgroundColor: "#303030", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "24px", marginBottom: "24px" }}>
        <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", marginBottom: "16px" }}>
          Trend po periodu
        </p>
        <TrendChart posts={published} />
      </div>

      {/* Post table */}
      <div style={{ backgroundColor: "#303030", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", overflow: "hidden" }}>
        <div style={{ padding: "20px 20px 16px" }}>
          <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", margin: 0 }}>
            Postovi — sortirај po engagementu
          </p>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", marginTop: "4px" }}>
            Klikni na kolonu za sortiranje · Klikni na red za uređivanje
          </p>
        </div>
        <PostTable posts={posts} clientId={id} />
      </div>
    </div>
  );
}
