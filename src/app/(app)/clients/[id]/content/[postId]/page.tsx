import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PostEditor from "./PostEditor";

const SOURCE_LABEL: Record<string, string> = {
  pillar: "Stub",
  inspiration: "Inspiracija",
  adhoc: "Ad hoc",
};

const TYPE_LABEL: Record<string, string> = {
  text: "Tekst post",
  image: "Image post",
  carousel: "Carousel",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("sr-RS", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function first<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string; postId: string }>;
}) {
  await requireUser();
  const { id, postId } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("content_posts")
    .select(`
      id, post_type, status, source, topic, content, slides, image_prompt,
      generated_image_url, inspiration_texts, notes, generated_at, published_at, created_at,
      scheduled_at, linkedin_post_url,
      impressions, likes, comments, shares,
      sender_profiles(id, full_name, linkedin_url),
      content_pillars(name, description)
    `)
    .eq("id", postId)
    .eq("client_id", id)
    .maybeSingle();

  if (!data) notFound();

  const post = data as any;
  const profile = first<any>(post.sender_profiles);
  const pillar = first<any>(post.content_pillars);

  let slides = post.slides;
  if (typeof slides === "string") {
    try { slides = JSON.parse(slides); } catch { slides = []; }
  }

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto" }}>
      <Link href={`/clients/${id}/content`} style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", textDecoration: "none", display: "inline-block", marginBottom: "16px" }}>
        ← Content
      </Link>

      {/* Header meta */}
      <div style={{ marginTop: "4px", marginBottom: "24px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
          <span style={{ fontWeight: 600, color: "#BDBDBD" }}>{TYPE_LABEL[post.post_type] ?? post.post_type}</span>
          <span>·</span>
          <span>{SOURCE_LABEL[post.source] ?? post.source}</span>
          {pillar && (
            <>
              <span>·</span>
              <span style={{ backgroundColor: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "999px", padding: "2px 8px", fontSize: "11px", color: "#A5B4FC" }}>
                {pillar.name}
              </span>
            </>
          )}
          {profile && (
            <>
              <span>·</span>
              <span>{profile.full_name}</span>
            </>
          )}
          <span>·</span>
          <span>Generisano {fmtDate(post.generated_at)}</span>
        </div>

        {post.topic && (
          <p style={{ marginTop: "8px", fontSize: "16px", fontWeight: 600, color: "#FFFFFF" }}>{post.topic}</p>
        )}
      </div>

      <PostEditor
        post={{ ...post, slides }}
        clientId={id}
      />

      {/* Inspiration sources */}
      {post.inspiration_texts?.length > 0 && (
        <div style={{ marginTop: "32px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "24px" }}>
          <p style={{ marginBottom: "12px", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)" }}>Inspiracija korišćena za generisanje</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {post.inspiration_texts.map((t: string, i: number) => (
              <div key={i} style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "12px 16px", fontSize: "12px", color: "#BDBDBD", whiteSpace: "pre-wrap", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
                {t}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
