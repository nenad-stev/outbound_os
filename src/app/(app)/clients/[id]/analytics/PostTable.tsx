"use client";

import { useState } from "react";
import Link from "next/link";

interface Post {
  id: string;
  topic: string | null;
  post_type: string;
  published_at: string | null;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  sender_profile_name: string | null;
}

type SortKey = "engagement" | "impressions" | "likes" | "comments" | "published_at";

const TYPE_LABEL: Record<string, string> = {
  text: "Tekst",
  image: "Slika",
  carousel: "Carousel",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("sr-RS", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function engagement(p: Post) {
  return (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0);
}

export default function PostTable({ posts, clientId }: { posts: Post[]; clientId: string }) {
  const [sort, setSort] = useState<SortKey>("engagement");
  const [dir, setDir]   = useState<"desc" | "asc">("desc");

  function toggleSort(key: SortKey) {
    if (sort === key) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSort(key); setDir("desc"); }
  }

  const sorted = [...posts].sort((a, b) => {
    let av = 0, bv = 0;
    if (sort === "engagement")   { av = engagement(a); bv = engagement(b); }
    else if (sort === "impressions") { av = a.impressions ?? 0; bv = b.impressions ?? 0; }
    else if (sort === "likes")   { av = a.likes ?? 0; bv = b.likes ?? 0; }
    else if (sort === "comments") { av = a.comments ?? 0; bv = b.comments ?? 0; }
    else if (sort === "published_at") {
      av = a.published_at ? new Date(a.published_at).getTime() : 0;
      bv = b.published_at ? new Date(b.published_at).getTime() : 0;
    }
    return dir === "desc" ? bv - av : av - bv;
  });

  const maxEng = Math.max(...posts.map(engagement), 1);
  const maxImp = Math.max(...posts.map((p) => p.impressions ?? 0), 1);

  function SortBtn({ k, label }: { k: SortKey; label: string }) {
    const active = sort === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        style={{
          background: "none", border: "none", cursor: "pointer", padding: 0,
          color: active ? "#FFCC00" : "rgba(255,255,255,0.35)",
          fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const,
          letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: "4px",
        }}
      >
        {label}
        {active && <span style={{ fontSize: "9px" }}>{dir === "desc" ? "↓" : "↑"}</span>}
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      {/* Header */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 90px 100px 80px 70px 70px 80px",
        gap: "12px", alignItems: "center",
        padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)" }}>Post</span>
        <SortBtn k="published_at" label="Datum" />
        <SortBtn k="impressions" label="Impresije" />
        <SortBtn k="likes" label="Lajkovi" />
        <SortBtn k="comments" label="Kom." />
        <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)" }}>Share</span>
        <SortBtn k="engagement" label="Eng." />
      </div>

      {sorted.length === 0 && (
        <div style={{ padding: "32px 16px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>
          Nema postova sa unetom analitikom.
        </div>
      )}

      {sorted.map((p) => {
        const eng = engagement(p);
        const engPct = maxEng > 0 ? (eng / maxEng) * 100 : 0;
        const impPct = maxImp > 0 ? ((p.impressions ?? 0) / maxImp) * 100 : 0;
        return (
          <Link
            key={p.id}
            href={`/clients/${clientId}/content/${p.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div
              className="row-hover"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 90px 100px 80px 70px 70px 80px",
                gap: "12px", alignItems: "center",
                padding: "12px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                cursor: "pointer",
              }}
            >
              {/* Topic */}
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: "13px", fontWeight: 500, color: "#FFFFFF", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.topic ?? "(bez naslova)"}
                </p>
                <div style={{ display: "flex", gap: "6px", marginTop: "2px" }}>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{TYPE_LABEL[p.post_type] ?? p.post_type}</span>
                  {p.sender_profile_name && (
                    <>
                      <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)" }}>·</span>
                      <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{p.sender_profile_name}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Date */}
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>{fmtDate(p.published_at)}</span>

              {/* Impressions with bar */}
              <div>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#FFFFFF" }}>
                  {(p.impressions ?? 0).toLocaleString("sr-RS")}
                </span>
                <div style={{ marginTop: "4px", height: "3px", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "2px" }}>
                  <div style={{ height: "3px", width: `${impPct}%`, backgroundColor: "#FFCC00", borderRadius: "2px" }} />
                </div>
              </div>

              {/* Likes */}
              <span style={{ fontSize: "13px", color: "#86EFAC", fontWeight: 500 }}>{p.likes ?? 0}</span>

              {/* Comments */}
              <span style={{ fontSize: "13px", color: "#A5B4FC", fontWeight: 500 }}>{p.comments ?? 0}</span>

              {/* Shares */}
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>{p.shares ?? 0}</span>

              {/* Engagement with bar */}
              <div>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#FFCC00" }}>{eng}</span>
                <div style={{ marginTop: "4px", height: "3px", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "2px" }}>
                  <div style={{ height: "3px", width: `${engPct}%`, backgroundColor: "#FFCC00", borderRadius: "2px" }} />
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
