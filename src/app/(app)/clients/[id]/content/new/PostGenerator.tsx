"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PostType = "text" | "image" | "carousel";
type Mode = "pillar" | "inspiration" | "adhoc";

interface Profile {
  id: string;
  full_name: string;
}

interface Pillar {
  id: string;
  name: string;
  description: string | null;
  strategy_id: string;
}

interface StrategyWithPillars {
  id: string;
  sender_profile_id: string;
  pillars: Pillar[];
}

interface Props {
  clientId: string;
  profiles: Profile[];
  strategies: StrategyWithPillars[];
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

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.35)",
  marginBottom: "8px",
  display: "block",
};

export default function PostGenerator({ clientId, profiles, strategies }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("pillar");
  const [postType, setPostType] = useState<PostType>("text");
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [topic, setTopic] = useState("");
  const [pillarId, setPillarId] = useState("");
  const [inspirations, setInspirations] = useState(["", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const currentStrategy = strategies.find((s) => s.sender_profile_id === profileId);
  const availablePillars = currentStrategy?.pillars ?? [];

  function addInspiration() {
    setInspirations((prev) => [...prev, ""]);
  }

  function setInspiration(i: number, val: string) {
    setInspirations((prev) => prev.map((v, idx) => (idx === i ? val : v)));
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);

    const body: Record<string, unknown> = {
      mode,
      post_type: postType,
      sender_profile_id: profileId,
      client_id: clientId,
    };

    if (mode === "pillar") {
      body.pillar_id = pillarId || undefined;
      body.topic = topic || undefined;
    } else if (mode === "inspiration") {
      body.inspiration_texts = inspirations.filter((t) => t.trim());
    } else {
      body.topic = topic;
    }

    try {
      const res = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generisanje nije uspelo.");
      } else {
        setResult(data.post);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const modes: { key: Mode; label: string }[] = [
    { key: "pillar", label: "Stubovi" },
    { key: "inspiration", label: "Inspiracija" },
    { key: "adhoc", label: "Ad hoc" },
  ];

  const postTypes: { key: PostType; label: string }[] = [
    { key: "text", label: "Tekst post" },
    { key: "image", label: "Image post" },
    { key: "carousel", label: "Carousel" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px" }}>
      {/* Left: config */}
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Sender profile */}
        <div>
          <label style={labelStyle}>Sender profil</label>
          <select
            value={profileId}
            onChange={(e) => { setProfileId(e.target.value); setPillarId(""); }}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id} style={{ backgroundColor: "#3B3B3B" }}>{p.full_name}</option>
            ))}
          </select>
        </div>

        {/* Mode tabs */}
        <div>
          <label style={labelStyle}>Mod generisanja</label>
          <div style={{ display: "flex", gap: "8px" }}>
            {modes.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                style={mode === m.key
                  ? { backgroundColor: "#FFCC00", color: "#272727", fontWeight: 600, borderRadius: "999px", padding: "5px 14px", fontSize: "12px", border: "none", cursor: "pointer" }
                  : { backgroundColor: "rgba(255,255,255,0.06)", color: "#BDBDBD", borderRadius: "999px", padding: "5px 14px", fontSize: "12px", border: "none", cursor: "pointer" }
                }
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mode-specific inputs */}
        {mode === "pillar" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Stub sadržaja</label>
              {availablePillars.length === 0 ? (
                <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)" }}>
                  Nema stubova za ovaj profil.{" "}
                  <a href={`/clients/${clientId}/content/strategy`} style={{ color: "#FFCC00", textDecoration: "none" }}>
                    Dodaj strategiju →
                  </a>
                </p>
              ) : (
                <select
                  value={pillarId}
                  onChange={(e) => setPillarId(e.target.value)}
                  style={{ ...inputStyle, cursor: "pointer" }}
                >
                  <option value="" style={{ backgroundColor: "#3B3B3B" }}>— Nasumičan iz strategije —</option>
                  {availablePillars.map((p) => (
                    <option key={p.id} value={p.id} style={{ backgroundColor: "#3B3B3B" }}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label style={labelStyle}>Specifičan ugao / tema (opciono)</label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Npr. 5 grešaka koje lideri prave u prvoj godini"
                style={inputStyle}
              />
            </div>
          </div>
        )}

        {mode === "inspiration" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <p style={{ fontSize: "13px", color: "#BDBDBD" }}>
              Nalepi LinkedIn postove koji su dobro performirali. AI će ih obraditi i kreirati originalni post u glasu pošiljaoca.
            </p>
            {inspirations.map((text, i) => (
              <div key={i}>
                <label style={labelStyle}>Post #{i + 1}</label>
                <textarea
                  value={text}
                  onChange={(e) => setInspiration(i, e.target.value)}
                  rows={4}
                  placeholder="Nalepi LinkedIn post ovde..."
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={addInspiration}
              style={{ alignSelf: "flex-start", fontSize: "13px", color: "#FFCC00", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              + Dodaj još inspiracije
            </button>
          </div>
        )}

        {mode === "adhoc" && (
          <div>
            <label style={labelStyle}>Tema / brief</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              placeholder="Opiši šta treba da pišemo — ugao, poruku, kontekst..."
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
        )}

        {/* Post type */}
        <div>
          <label style={labelStyle}>Tip posta</label>
          <div style={{ display: "flex", gap: "8px" }}>
            {postTypes.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setPostType(t.key)}
                style={postType === t.key
                  ? { backgroundColor: "rgba(99,102,241,0.2)", color: "#A5B4FC", border: "1px solid rgba(99,102,241,0.4)", borderRadius: "999px", padding: "5px 14px", fontSize: "12px", cursor: "pointer" }
                  : { backgroundColor: "rgba(255,255,255,0.06)", color: "#BDBDBD", border: "none", borderRadius: "999px", padding: "5px 14px", fontSize: "12px", cursor: "pointer" }
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || !profileId}
          style={{ backgroundColor: "#FFCC00", color: "#272727", fontWeight: 600, borderRadius: "12px", padding: "12px 20px", fontSize: "14px", border: "none", cursor: loading || !profileId ? "not-allowed" : "pointer", opacity: loading || !profileId ? 0.6 : 1 }}
        >
          {loading ? "Generišem…" : "Generiši post"}
        </button>

        {error && (
          <p style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "12px", padding: "12px 16px", fontSize: "13px", color: "#F87171" }}>
            {error}
          </p>
        )}
      </div>

      {/* Right: result */}
      <div>
        {loading && (
          <div style={{ display: "flex", height: "192px", alignItems: "center", justifyContent: "center", backgroundColor: "#303030", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "24px", height: "24px", border: "2px solid rgba(255,255,255,0.12)", borderTopColor: "#FFCC00", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)" }}>Claude piše post…</span>
            </div>
          </div>
        )}

        {result && !loading && (
          <div style={{ backgroundColor: "#303030", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "20px" }}>
            <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", color: "#BDBDBD" }}>
                {result.post_type === "carousel" ? "Carousel" : result.post_type === "image" ? "Image post" : "Tekst post"} ·{" "}
                <span style={{ color: "#86EFAC" }}>Sačuvan kao draft</span>
              </span>
              <button
                type="button"
                onClick={() => router.push(`/clients/${clientId}/content`)}
                style={{ fontSize: "12px", color: "#FFCC00", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                Vidi u biblioteci →
              </button>
            </div>

            {result.post_type === "carousel" && result.slides ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {(typeof result.slides === "string" ? JSON.parse(result.slides) : result.slides).map(
                  (slide: any, i: number) => (
                    <div
                      key={i}
                      style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "12px 16px" }}
                    >
                      <p style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Slajd {i + 1}</p>
                      <p style={{ marginTop: "4px", fontSize: "14px", fontWeight: 600, color: "#FFFFFF" }}>{slide.title}</p>
                      <p style={{ marginTop: "4px", fontSize: "13px", color: "#BDBDBD" }}>{slide.body}</p>
                      {slide.cta && (
                        <p style={{ marginTop: "4px", fontSize: "12px", fontWeight: 600, color: "#FFCC00" }}>{slide.cta}</p>
                      )}
                    </div>
                  )
                )}
              </div>
            ) : (
              <>
                <p style={{ whiteSpace: "pre-wrap", fontSize: "14px", color: "#FFFFFF", lineHeight: "1.6" }}>{result.content}</p>
                {result.image_prompt && (
                  <div style={{ marginTop: "16px", backgroundColor: "rgba(255,204,0,0.08)", border: "1px solid rgba(255,204,0,0.15)", borderRadius: "10px", padding: "12px 16px" }}>
                    <p style={{ fontSize: "11px", fontWeight: 600, color: "#FFCC00" }}>Visual brief za sliku</p>
                    <p style={{ marginTop: "4px", fontSize: "13px", color: "#BDBDBD" }}>{result.image_prompt}</p>
                  </div>
                )}
              </>
            )}

            <div style={{ marginTop: "16px", display: "flex", gap: "8px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "12px" }}>
              <button
                type="button"
                onClick={() => {
                  const text =
                    result.post_type === "carousel"
                      ? JSON.stringify(result.slides, null, 2)
                      : result.content ?? "";
                  navigator.clipboard.writeText(text);
                }}
                style={{ backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", borderRadius: "12px", padding: "8px 16px", fontSize: "13px", cursor: "pointer" }}
              >
                Kopiraj
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                style={{ backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", borderRadius: "12px", padding: "8px 16px", fontSize: "13px", cursor: "pointer" }}
              >
                Regeneriši
              </button>
            </div>
          </div>
        )}

        {!result && !loading && (
          <div style={{ display: "flex", height: "192px", alignItems: "center", justifyContent: "center", backgroundColor: "#303030", border: "1px dashed rgba(255,255,255,0.10)", borderRadius: "16px" }}>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.25)" }}>Ovde će se pojaviti generisani post.</p>
          </div>
        )}
      </div>
    </div>
  );
}
