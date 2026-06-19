"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approvePost, archivePost, markPublished, updatePostContent, schedulePost, cancelSchedule } from "@/app/actions/content";
import { savePostAnalytics } from "@/app/actions/analytics";

interface Slide {
  title: string;
  body: string;
  cta?: string;
}

interface Post {
  id: string;
  post_type: "text" | "image" | "carousel";
  status: "draft" | "approved" | "scheduled" | "published" | "archived";
  source: string;
  topic: string | null;
  content: string | null;
  slides: Slide[] | null;
  image_prompt: string | null;
  generated_image_url: string | null;
  notes: string | null;
  scheduled_at: string | null;
  linkedin_post_url: string | null;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
}

interface Props {
  post: Post;
  clientId: string;
}

const inputStyle: React.CSSProperties = {
  backgroundColor: "#3B3B3B",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "12px",
  color: "#FFFFFF",
  padding: "10px 14px",
  fontSize: "14px",
  width: "100%",
  outline: "none",
};

function statusBadge(status: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    draft:     { backgroundColor: "rgba(255,255,255,0.08)", color: "#BDBDBD" },
    approved:  { backgroundColor: "rgba(255,204,0,0.15)", color: "#FFCC00" },
    scheduled: { backgroundColor: "rgba(99,102,241,0.15)", color: "#A5B4FC" },
    published: { backgroundColor: "rgba(134,239,172,0.12)", color: "#86EFAC" },
    archived:  { backgroundColor: "rgba(239,68,68,0.08)", color: "#F87171" },
  };
  return { ...(map[status] ?? map.draft), borderRadius: "999px", padding: "3px 10px", fontSize: "11px", fontWeight: 500 };
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  approved: "Odobreno",
  scheduled: "Zakazano",
  published: "Objavljeno",
  archived: "Arhivirano",
};

// "2026-06-20T09:00" in local time, for a datetime-local default (now + 1h).
function defaultScheduleValue(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtSchedule(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("sr-RS", {
    weekday: "short", day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function PostEditor({ post, clientId }: Props) {
  const router = useRouter();
  const [content, setContent] = useState(post.content ?? "");
  const [slides, setSlides] = useState<Slide[]>(post.slides ?? []);
  const [imageUrl, setImageUrl] = useState<string | null>(post.generated_image_url ?? null);
  const [imageBrief, setImageBrief] = useState(post.image_prompt ?? "");
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [impressions, setImpressions] = useState(post.impressions ?? 0);
  const [likes, setLikes]             = useState(post.likes       ?? 0);
  const [comments, setComments]       = useState(post.comments    ?? 0);
  const [shares, setShares]           = useState(post.shares      ?? 0);
  const [savingAnalytics, setSavingAnalytics] = useState(false);
  const [savedAnalytics, setSavedAnalytics]   = useState(false);
  const [scheduledInput, setScheduledInput] = useState(defaultScheduleValue());
  const [scheduling, setScheduling] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSchedule() {
    setScheduling(true);
    setScheduleMsg(null);
    const fd = new FormData();
    fd.set("post_id", post.id);
    fd.set("client_id", clientId);
    fd.set("content", content);
    fd.set("scheduled_at", scheduledInput);
    const res = await schedulePost(fd);
    setScheduling(false);
    if (res.ok) {
      setScheduleMsg({ ok: true, text: "Zakazano ✓" });
      router.refresh();
    } else {
      setScheduleMsg({ ok: false, text: res.error ?? "Zakazivanje nije uspelo." });
    }
  }

  async function handleCancelSchedule() {
    const fd = new FormData();
    fd.set("post_id", post.id);
    fd.set("client_id", clientId);
    await cancelSchedule(fd);
    setScheduleMsg(null);
    router.refresh();
  }

  function updateSlide(i: number, field: keyof Slide, val: string) {
    setSlides((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  }

  async function generateImage(slideIndex?: number) {
    setGeneratingImage(true);
    setImageError(null);
    try {
      const res = await fetch("/api/content/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: post.id,
          client_id: clientId,
          slide_index: slideIndex ?? 0,
          custom_prompt: imageBrief.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImageError(data.error ?? "Generisanje slike nije uspelo.");
      } else {
        setImageUrl(data.image_url);
      }
    } catch (e: any) {
      setImageError(e.message);
    } finally {
      setGeneratingImage(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const fd = new FormData();
    fd.set("post_id", post.id);
    fd.set("client_id", clientId);
    if (post.post_type === "carousel") {
      fd.set("content", JSON.stringify(slides));
    } else {
      fd.set("content", content);
    }
    await updatePostContent(fd);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Status bar */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }}>
        <span style={statusBadge(post.status)}>
          {STATUS_LABEL[post.status]}
        </span>

        {post.status === "draft" && (
          <form action={approvePost} onSubmit={() => router.refresh()}>
            <input type="hidden" name="post_id" value={post.id} />
            <input type="hidden" name="client_id" value={clientId} />
            <button
              type="submit"
              style={{ backgroundColor: "rgba(255,204,0,0.12)", border: "1px solid rgba(255,204,0,0.2)", borderRadius: "10px", padding: "6px 14px", fontSize: "12px", color: "#FFCC00", cursor: "pointer" }}
            >
              Odobri
            </button>
          </form>
        )}

        {post.status === "approved" && (
          <form action={markPublished} onSubmit={() => router.refresh()}>
            <input type="hidden" name="post_id" value={post.id} />
            <input type="hidden" name="client_id" value={clientId} />
            <button
              type="submit"
              style={{ backgroundColor: "rgba(134,239,172,0.08)", border: "1px solid rgba(134,239,172,0.2)", borderRadius: "10px", padding: "6px 14px", fontSize: "12px", color: "#86EFAC", cursor: "pointer" }}
            >
              Označi kao objavljeno
            </button>
          </form>
        )}

        {post.status !== "archived" && (
          <form action={archivePost} onSubmit={() => router.refresh()}>
            <input type="hidden" name="post_id" value={post.id} />
            <input type="hidden" name="client_id" value={clientId} />
            <button
              type="submit"
              style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#F87171", borderRadius: "10px", padding: "6px 14px", fontSize: "12px", cursor: "pointer" }}
            >
              Arhiviraj
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => {
            const text = post.post_type === "carousel"
              ? slides.map((s, i) => `Slajd ${i + 1}: ${s.title}\n${s.body}${s.cta ? `\n${s.cta}` : ""}`).join("\n\n")
              : content;
            navigator.clipboard?.writeText(text);
          }}
          style={{ backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", borderRadius: "10px", padding: "6px 14px", fontSize: "12px", cursor: "pointer" }}
        >
          Kopiraj
        </button>
      </div>

      {/* Editor */}
      {post.post_type === "text" && (
        <div>
          <label style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", marginBottom: "8px", display: "block" }}>Tekst posta</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            style={{ ...inputStyle, resize: "vertical", lineHeight: "1.6" }}
          />
          <p style={{ marginTop: "4px", textAlign: "right", fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{content.length} znakova</p>
        </div>
      )}

      {post.post_type === "image" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", marginBottom: "8px", display: "block" }}>Caption</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              style={{ ...inputStyle, resize: "vertical", lineHeight: "1.6" }}
            />
            <p style={{ marginTop: "4px", textAlign: "right", fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{content.length} znakova</p>
          </div>
          {post.image_prompt && (
            <div style={{ backgroundColor: "rgba(255,204,0,0.08)", border: "1px solid rgba(255,204,0,0.15)", borderRadius: "12px", padding: "12px 16px" }}>
              <p style={{ fontSize: "11px", fontWeight: 600, color: "#FFCC00" }}>Visual brief za sliku</p>
              <p style={{ marginTop: "4px", fontSize: "13px", color: "#BDBDBD" }}>{post.image_prompt}</p>
            </div>
          )}
          <ImageSection
            imageUrl={imageUrl}
            brief={imageBrief}
            onBriefChange={setImageBrief}
            generating={generatingImage}
            error={imageError}
            onGenerate={() => generateImage(0)}
          />
        </div>
      )}

      {post.post_type === "carousel" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)" }}>Slajdovi ({slides.length})</label>
            <button
              type="button"
              onClick={() => setSlides((prev) => [...prev, { title: "", body: "", cta: "" }])}
              style={{ fontSize: "13px", color: "#FFCC00", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              + Dodaj slajd
            </button>
          </div>
          {slides.map((slide, i) => (
            <div key={i} style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "16px" }}>
              <div style={{ marginBottom: "10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Slajd {i + 1}</span>
                {slides.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSlides((prev) => prev.filter((_, idx) => idx !== i))}
                    style={{ fontSize: "12px", color: "#F87171", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    Ukloni
                  </button>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <input
                  value={slide.title}
                  onChange={(e) => updateSlide(i, "title", e.target.value)}
                  placeholder="Naslov slajda"
                  style={{ ...inputStyle, fontWeight: 600 }}
                />
                <textarea
                  value={slide.body}
                  onChange={(e) => updateSlide(i, "body", e.target.value)}
                  rows={3}
                  placeholder="Telo slajda (2–4 kratke linije)"
                  style={{ ...inputStyle, resize: "vertical" }}
                />
                {i === slides.length - 1 && (
                  <input
                    value={slide.cta ?? ""}
                    onChange={(e) => updateSlide(i, "cta", e.target.value)}
                    placeholder="CTA (opciono, samo na poslednjem slajdu)"
                    style={{ ...inputStyle, fontSize: "13px" }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image section for carousel */}
      {post.post_type === "carousel" && (
        <ImageSection
          imageUrl={imageUrl}
          brief={imageBrief}
          onBriefChange={setImageBrief}
          generating={generatingImage}
          error={imageError}
          onGenerate={() => generateImage(0)}
          label="Generiši cover sliku"
        />
      )}

      {/* Save */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{ backgroundColor: "#FFCC00", color: "#272727", fontWeight: 600, borderRadius: "12px", padding: "10px 20px", fontSize: "14px", border: "none", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Čuvam…" : "Sačuvaj izmene"}
        </button>
        {saved && (
          <span style={{ fontSize: "13px", color: "#86EFAC" }}>Sačuvano ✓</span>
        )}
      </div>

      {/* Scheduling section */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "24px", marginTop: "8px" }}>
        <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", marginBottom: "16px" }}>
          Zakaži objavu na LinkedIn
        </p>

        {post.post_type !== "text" ? (
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>
            Automatska objava za sada podržava samo tekst postove. Za {post.post_type === "image" ? "image" : "carousel"} postove označi ručno kao objavljeno.
          </p>
        ) : post.status === "scheduled" ? (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "14px", color: "#A5B4FC" }}>
              Zakazano za <strong>{fmtSchedule(post.scheduled_at)}</strong>
            </span>
            <button
              type="button"
              onClick={handleCancelSchedule}
              style={{ backgroundColor: "transparent", border: "1px solid rgba(239,68,68,0.3)", color: "#F87171", borderRadius: "10px", padding: "6px 14px", fontSize: "12px", cursor: "pointer" }}
            >
              Otkaži zakazivanje
            </button>
          </div>
        ) : post.status === "published" ? (
          <div style={{ fontSize: "13px", color: "#86EFAC" }}>
            Objavljeno{post.linkedin_post_url ? (
              <> · <a href={post.linkedin_post_url} target="_blank" rel="noopener noreferrer" style={{ color: "#FFCC00", textDecoration: "none" }}>Vidi post →</a></>
            ) : null}
          </div>
        ) : (post.status === "draft" || post.status === "approved") ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
              <input
                type="datetime-local"
                value={scheduledInput}
                min={defaultScheduleValue()}
                onChange={(e) => setScheduledInput(e.target.value)}
                style={{ ...inputStyle, width: "auto", colorScheme: "dark" }}
              />
              <button
                type="button"
                onClick={handleSchedule}
                disabled={scheduling}
                style={{ backgroundColor: "#6366F1", color: "#FFFFFF", fontWeight: 600, borderRadius: "12px", padding: "10px 20px", fontSize: "14px", border: "none", cursor: scheduling ? "not-allowed" : "pointer", opacity: scheduling ? 0.6 : 1 }}
              >
                {scheduling ? "Zakazujem…" : "Zakaži objavu"}
              </button>
            </div>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
              n8n će objaviti tekst posta na LinkedIn nalogu identityja u zakazano vreme. Trenutni sadržaj iz editora se snima i koristi.
            </p>
            {scheduleMsg && (
              <span style={{ fontSize: "13px", color: scheduleMsg.ok ? "#86EFAC" : "#F87171" }}>{scheduleMsg.text}</span>
            )}
          </div>
        ) : null}
      </div>

      {/* Analytics section */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "24px", marginTop: "8px" }}>
        <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", marginBottom: "16px" }}>
          LinkedIn analitika
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
          {([
            { label: "Impresije", state: impressions, set: setImpressions },
            { label: "Lajkovi",   state: likes,       set: setLikes       },
            { label: "Komentari", state: comments,    set: setComments    },
            { label: "Shares",    state: shares,      set: setShares      },
          ] as const).map((field) => (
            <div key={field.label}>
              <label style={{ display: "block", fontSize: "11px", color: "rgba(255,255,255,0.35)", marginBottom: "4px" }}>{field.label}</label>
              <input
                type="number"
                min="0"
                value={field.state}
                onChange={(e) => field.set(parseInt(e.target.value) || 0)}
                style={{ ...inputStyle, textAlign: "right" }}
              />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            type="button"
            onClick={async () => {
              setSavingAnalytics(true);
              setSavedAnalytics(false);
              const fd = new FormData();
              fd.set("post_id",    post.id);
              fd.set("client_id",  clientId);
              fd.set("impressions", String(impressions));
              fd.set("likes",       String(likes));
              fd.set("comments",    String(comments));
              fd.set("shares",      String(shares));
              await savePostAnalytics(fd);
              setSavingAnalytics(false);
              setSavedAnalytics(true);
              setTimeout(() => setSavedAnalytics(false), 2000);
            }}
            disabled={savingAnalytics}
            style={{ backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#FFFFFF", borderRadius: "12px", padding: "10px 20px", fontSize: "14px", cursor: savingAnalytics ? "not-allowed" : "pointer", opacity: savingAnalytics ? 0.6 : 1 }}
          >
            {savingAnalytics ? "Čuvam…" : "Sačuvaj analitiku"}
          </button>
          {savedAnalytics && <span style={{ fontSize: "13px", color: "#86EFAC" }}>Sačuvano ✓</span>}
        </div>
      </div>
    </div>
  );
}

function ImageSection({
  imageUrl,
  brief,
  onBriefChange,
  generating,
  error,
  onGenerate,
  label = "Generiši sliku",
}: {
  imageUrl: string | null;
  brief: string;
  onBriefChange: (v: string) => void;
  generating: boolean;
  error: string | null;
  onGenerate: () => void;
  label?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)" }}>Slika</p>

      <div>
        <label style={{ marginBottom: "6px", display: "block", fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>Visual brief (edituj pre generisanja)</label>
        <textarea
          value={brief}
          onChange={(e) => onBriefChange(e.target.value)}
          rows={3}
          placeholder="Opiši kako treba da izgleda slika — stil, boje, mood, elementi..."
          style={{ backgroundColor: "#3B3B3B", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "12px", color: "#FFFFFF", padding: "10px 14px", fontSize: "14px", width: "100%", outline: "none", resize: "vertical" }}
        />
      </div>

      <div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          style={{ backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#FFFFFF", borderRadius: "12px", padding: "10px 20px", fontSize: "14px", cursor: generating ? "not-allowed" : "pointer", opacity: generating ? 0.5 : 1 }}
        >
          {generating ? (
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "12px", height: "12px", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#FFFFFF", borderRadius: "50%", display: "inline-block" }} />
              Generišem…
            </span>
          ) : imageUrl ? "Regeneriši" : label}
        </button>
      </div>

      {error && (
        <p style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", color: "#F87171" }}>{error}</p>
      )}

      {imageUrl && (
        <div style={{ overflow: "hidden", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.06)" }}>
          <img src={imageUrl} alt="Generisana slika" style={{ width: "100%", objectFit: "cover" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "10px 14px" }}>
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>DALL-E 3 · 1024×1024</span>
            <a
              href={imageUrl}
              download="post-image.png"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: "12px", color: "#FFCC00", textDecoration: "none" }}
            >
              Preuzmi →
            </a>
          </div>
        </div>
      )}

      {!imageUrl && !generating && (
        <div style={{ display: "flex", height: "128px", alignItems: "center", justifyContent: "center", backgroundColor: "#303030", border: "1px dashed rgba(255,255,255,0.10)", borderRadius: "14px" }}>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.25)" }}>Klikni dugme za generisanje slike.</p>
        </div>
      )}
    </div>
  );
}
