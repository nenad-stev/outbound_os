import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { approvePost, archivePost, markPublished } from "@/app/actions/content";
import CopyButton from "./CopyButton";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  approved: "Odobreno",
  published: "Objavljeno",
  archived: "Arhivirano",
};

function statusBadge(status: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    draft:     { backgroundColor: "rgba(255,255,255,0.08)", color: "#BDBDBD" },
    approved:  { backgroundColor: "rgba(255,204,0,0.15)", color: "#FFCC00" },
    published: { backgroundColor: "rgba(134,239,172,0.12)", color: "#86EFAC" },
    archived:  { backgroundColor: "rgba(239,68,68,0.08)", color: "#F87171" },
  };
  return { ...(map[status] ?? map.draft), borderRadius: "999px", padding: "3px 10px", fontSize: "11px", fontWeight: 500 };
}

const SOURCE_LABEL: Record<string, string> = {
  pillar: "Stub",
  inspiration: "Inspiracija",
  adhoc: "Ad hoc",
};

const TYPE_ICON: Record<string, string> = {
  text: "T",
  image: "I",
  carousel: "C",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("sr-RS", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function first<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function ContentLibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; profile?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const { status: statusFilter, profile: profileFilter } = await searchParams;

  const supabase = await createClient();

  const [{ data: clientData }, { data: profiles }] = await Promise.all([
    supabase.from("clients").select("id, name").eq("id", id).maybeSingle(),
    supabase.from("sender_profiles").select("id, full_name").eq("client_id", id).order("full_name"),
  ]);

  if (!clientData) notFound();

  let query = supabase
    .from("content_posts")
    .select(`
      id, post_type, status, source, topic, content, slides, image_prompt,
      generated_image_url, generated_at, published_at, notes,
      sender_profiles(id, full_name),
      content_pillars(name)
    `)
    .eq("client_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (statusFilter && ["draft", "approved", "published", "archived"].includes(statusFilter)) {
    query = query.eq("status", statusFilter);
  }
  if (profileFilter) {
    query = query.eq("sender_profile_id", profileFilter);
  }

  const { data: posts } = await query;
  const list = (posts ?? []) as any[];

  const allStatuses = ["draft", "approved", "published", "archived"];

  return (
    <div>
      <Link href={`/clients/${id}`} style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", textDecoration: "none", display: "inline-block", marginBottom: "16px" }}>
        ← {clientData.name}
      </Link>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "8px 0 20px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#FFFFFF" }}>Content</h1>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", marginTop: "4px" }}>Biblioteka generisanih postova.</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Link
            href={`/clients/${id}/content/strategy`}
            style={{ backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#FFFFFF", borderRadius: "12px", padding: "10px 20px", fontSize: "14px", textDecoration: "none" }}
          >
            Strategija
          </Link>
          <Link
            href={`/clients/${id}/content/new`}
            style={{ backgroundColor: "#FFCC00", color: "#272727", fontWeight: 600, borderRadius: "12px", padding: "10px 20px", fontSize: "14px", textDecoration: "none" }}
          >
            + Novi post
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
        <Link
          href={`/clients/${id}/content`}
          style={!statusFilter
            ? { backgroundColor: "#FFCC00", color: "#272727", fontWeight: 600, borderRadius: "999px", padding: "5px 14px", fontSize: "12px", textDecoration: "none" }
            : { backgroundColor: "rgba(255,255,255,0.06)", color: "#BDBDBD", borderRadius: "999px", padding: "5px 14px", fontSize: "12px", textDecoration: "none" }
          }
        >
          Svi
        </Link>
        {allStatuses.map((s) => (
          <Link
            key={s}
            href={`/clients/${id}/content?status=${s}`}
            style={statusFilter === s
              ? { backgroundColor: "#FFCC00", color: "#272727", fontWeight: 600, borderRadius: "999px", padding: "5px 14px", fontSize: "12px", textDecoration: "none" }
              : { backgroundColor: "rgba(255,255,255,0.06)", color: "#BDBDBD", borderRadius: "999px", padding: "5px 14px", fontSize: "12px", textDecoration: "none" }
            }
          >
            {STATUS_LABEL[s]}
          </Link>
        ))}

        {(profiles ?? []).length > 1 && (
          <div style={{ marginLeft: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>Profil:</span>
            {(profiles ?? []).map((p: any) => (
              <Link
                key={p.id}
                href={`/clients/${id}/content?${statusFilter ? `status=${statusFilter}&` : ""}profile=${p.id}`}
                style={profileFilter === p.id
                  ? { backgroundColor: "rgba(99,102,241,0.2)", color: "#A5B4FC", borderRadius: "999px", padding: "5px 14px", fontSize: "12px", textDecoration: "none" }
                  : { backgroundColor: "rgba(255,255,255,0.06)", color: "#BDBDBD", borderRadius: "999px", padding: "5px 14px", fontSize: "12px", textDecoration: "none" }
                }
              >
                {p.full_name}
              </Link>
            ))}
            {profileFilter && (
              <Link
                href={`/clients/${id}/content${statusFilter ? `?status=${statusFilter}` : ""}`}
                style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", textDecoration: "none" }}
              >
                × Resetuj
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Post list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {list.map((post) => {
          const profile = first<any>(post.sender_profiles);
          const pillar = first<any>(post.content_pillars);

          const previewText =
            post.post_type === "carousel"
              ? (() => {
                  try {
                    const slides = typeof post.slides === "string" ? JSON.parse(post.slides) : post.slides;
                    return slides?.[0]?.title ?? "Carousel";
                  } catch {
                    return "Carousel";
                  }
                })()
              : post.content ?? "";

          return (
            <div
              key={post.id}
              style={{ backgroundColor: "#303030", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "20px" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
                {/* Thumbnail */}
                {post.generated_image_url && (
                  <Link href={`/clients/${id}/content/${post.id}`} style={{ flexShrink: 0 }}>
                    <img
                      src={post.generated_image_url}
                      alt=""
                      style={{ width: "64px", height: "64px", borderRadius: "10px", objectFit: "cover", border: "1px solid rgba(255,255,255,0.08)" }}
                    />
                  </Link>
                )}
                <Link href={`/clients/${id}/content/${post.id}`} style={{ flex: 1, minWidth: 0, textDecoration: "none" }}>
                  {/* Meta row */}
                  <div style={{ marginBottom: "8px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
                    <span style={{ display: "flex", width: "20px", height: "20px", alignItems: "center", justifyContent: "center", borderRadius: "6px", backgroundColor: "rgba(255,255,255,0.08)", fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.35)" }}>
                      {TYPE_ICON[post.post_type] ?? "?"}
                    </span>
                    <span style={statusBadge(post.status)}>
                      {STATUS_LABEL[post.status] ?? post.status}
                    </span>
                    <span style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "999px", padding: "3px 10px", fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                      {SOURCE_LABEL[post.source] ?? post.source}
                    </span>
                    {pillar && (
                      <span style={{ backgroundColor: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "999px", padding: "3px 10px", fontSize: "11px", color: "#A5B4FC" }}>
                        {pillar.name}
                      </span>
                    )}
                    {profile && (
                      <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>{profile.full_name}</span>
                    )}
                    <span style={{ marginLeft: "auto", fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>{fmtDate(post.generated_at)}</span>
                  </div>

                  {post.topic && (
                    <p style={{ marginBottom: "4px", fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.35)" }}>{post.topic}</p>
                  )}

                  <p style={{ fontSize: "14px", color: "#BDBDBD", whiteSpace: "pre-wrap", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
                    {previewText}
                  </p>

                  {!post.generated_image_url && post.image_prompt && (
                    <p style={{ marginTop: "8px", fontSize: "12px", color: "#A5B4FC", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      Visual brief: {post.image_prompt}
                    </p>
                  )}

                  <p style={{ marginTop: "8px", fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>Otvori i edituj →</p>
                </Link>

                {/* Actions */}
                <div style={{ display: "flex", flexShrink: 0, flexDirection: "column", gap: "6px" }}>
                  {post.status === "draft" && (
                    <form action={approvePost}>
                      <input type="hidden" name="post_id" value={post.id} />
                      <input type="hidden" name="client_id" value={id} />
                      <button type="submit"
                        style={{ width: "100%", backgroundColor: "rgba(255,204,0,0.12)", border: "1px solid rgba(255,204,0,0.2)", borderRadius: "10px", padding: "6px 12px", fontSize: "12px", color: "#FFCC00", cursor: "pointer" }}>
                        Odobri
                      </button>
                    </form>
                  )}

                  {post.status === "approved" && (
                    <form action={markPublished}>
                      <input type="hidden" name="post_id" value={post.id} />
                      <input type="hidden" name="client_id" value={id} />
                      <button type="submit"
                        style={{ width: "100%", backgroundColor: "rgba(134,239,172,0.08)", border: "1px solid rgba(134,239,172,0.2)", borderRadius: "10px", padding: "6px 12px", fontSize: "12px", color: "#86EFAC", cursor: "pointer" }}>
                        Objavljeno
                      </button>
                    </form>
                  )}

                  <CopyButton
                    text={
                      post.post_type === "carousel"
                        ? (() => {
                            try {
                              const slides = typeof post.slides === "string" ? JSON.parse(post.slides) : post.slides;
                              return JSON.stringify(slides, null, 2);
                            } catch { return ""; }
                          })()
                        : post.content ?? ""
                    }
                  />

                  {post.status !== "archived" && (
                    <form action={archivePost}>
                      <input type="hidden" name="post_id" value={post.id} />
                      <input type="hidden" name="client_id" value={id} />
                      <button type="submit"
                        style={{ width: "100%", backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#F87171", borderRadius: "10px", padding: "6px 12px", fontSize: "12px", cursor: "pointer" }}>
                        Arhiviraj
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {list.length === 0 && (
          <div style={{ padding: "64px 0", textAlign: "center", fontSize: "14px", color: "rgba(255,255,255,0.35)" }}>
            Nema postova.{" "}
            <Link href={`/clients/${id}/content/new`} style={{ color: "#FFCC00", textDecoration: "none" }}>
              Generiši prvi post →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
