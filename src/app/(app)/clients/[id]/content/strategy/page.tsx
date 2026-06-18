import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { upsertStrategy, addPillar, deletePillar } from "@/app/actions/content";

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

export default async function ContentStrategyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: clientData }, { data: profiles }] = await Promise.all([
    supabase.from("clients").select("id, name").eq("id", id).maybeSingle(),
    supabase
      .from("sender_profiles")
      .select("id, full_name, linkedin_url")
      .eq("client_id", id)
      .order("full_name"),
  ]);

  if (!clientData) notFound();

  const profileIds = (profiles ?? []).map((p: any) => p.id);
  const { data: strategies } = profileIds.length > 0
    ? await supabase.from("content_strategies").select("*").in("sender_profile_id", profileIds)
    : { data: [] as any[] };

  const strategyIds = (strategies ?? []).map((s: any) => s.id);
  const { data: pillars } = strategyIds.length > 0
    ? await supabase.from("content_pillars").select("*").in("strategy_id", strategyIds).order("sort_order")
    : { data: [] as any[] };

  const strategyMap = new Map((strategies ?? []).map((s: any) => [s.sender_profile_id, s]));
  const pillarsByStrategy = new Map<string, any[]>();
  for (const p of (pillars as any[]) ?? []) {
    const arr = pillarsByStrategy.get(p.strategy_id) ?? [];
    arr.push(p);
    pillarsByStrategy.set(p.strategy_id, arr);
  }

  return (
    <div>
      <Link href={`/clients/${id}/content`} style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", textDecoration: "none", display: "inline-block", marginBottom: "16px" }}>
        ← Content
      </Link>
      <h1 style={{ marginTop: "4px", fontSize: "28px", fontWeight: 700, color: "#FFFFFF" }}>Content Strategy</h1>
      <p style={{ marginTop: "4px", fontSize: "14px", color: "#BDBDBD" }}>
        Definiši strategiju i stubove sadržaja za svaki sender profil.
      </p>

      {(profiles ?? []).length === 0 && (
        <p style={{ marginTop: "24px", fontSize: "14px", color: "rgba(255,255,255,0.35)" }}>
          Nema sender profila za ovog klijenta.{" "}
          <Link href={`/clients/${id}/profiles/new`} style={{ color: "#FFCC00", textDecoration: "none" }}>
            Dodaj profil →
          </Link>
        </p>
      )}

      <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "32px" }}>
        {(profiles ?? []).map((profile: any) => {
          const strategy = strategyMap.get(profile.id);
          const strategyPillars = strategy ? (pillarsByStrategy.get(strategy.id) ?? []) : [];

          return (
            <section
              key={profile.id}
              style={{ backgroundColor: "#303030", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "24px" }}
            >
              <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "#3B3B3B", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 600, color: "#FFFFFF", flexShrink: 0 }}>
                  {profile.full_name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: 600, color: "#FFFFFF" }}>{profile.full_name}</p>
                  {profile.linkedin_url && (
                    <a
                      href={profile.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "12px", color: "#A5B4FC", textDecoration: "none" }}
                    >
                      LinkedIn ↗
                    </a>
                  )}
                </div>
              </div>

              {/* Strategy form */}
              <form action={upsertStrategy} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <input type="hidden" name="sender_profile_id" value={profile.id} />
                <input type="hidden" name="client_id" value={id} />

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>O pošiljaocu (pozadina, ekspertiza)</label>
                  <textarea
                    name="about_me"
                    rows={3}
                    defaultValue={strategy?.about_me ?? ""}
                    placeholder="Npr. Osnivač SaaS kompanije za HR automaciju, 10+ godina iskustva u B2B prodaji..."
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Ton i glas</label>
                  <input
                    name="tone_voice"
                    defaultValue={strategy?.tone_voice ?? ""}
                    placeholder="Npr. Direktan, stručan, bez korporativnog žargona"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Ciljna publika</label>
                  <input
                    name="target_audience"
                    defaultValue={strategy?.target_audience ?? ""}
                    placeholder="Npr. HR direktori u kompanijama 50–500 zaposlenih"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Frekvencija objavljivanja</label>
                  <input
                    name="posting_frequency"
                    defaultValue={strategy?.posting_frequency ?? ""}
                    placeholder="Npr. 3× nedeljno"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Dodatna pravila</label>
                  <input
                    name="extra_rules"
                    defaultValue={strategy?.extra_rules ?? ""}
                    placeholder="Npr. Bez emojija, uvek završi pitanjem"
                    style={inputStyle}
                  />
                </div>

                <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="submit"
                    style={{ backgroundColor: "#FFCC00", color: "#272727", fontWeight: 600, borderRadius: "12px", padding: "10px 20px", fontSize: "14px", border: "none", cursor: "pointer" }}
                  >
                    Sačuvaj strategiju
                  </button>
                </div>
              </form>

              {/* Pillars section */}
              {strategy && (
                <div style={{ marginTop: "24px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "24px" }}>
                  <p style={{ marginBottom: "12px", fontSize: "14px", fontWeight: 600, color: "#FFFFFF" }}>
                    Stubovi sadržaja ({strategyPillars.length})
                  </p>

                  {strategyPillars.length > 0 && (
                    <div style={{ marginBottom: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {strategyPillars.map((pillar: any) => (
                        <div
                          key={pillar.id}
                          style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "14px 16px" }}
                        >
                          <div>
                            <p style={{ fontSize: "14px", fontWeight: 600, color: "#FFFFFF" }}>{pillar.name}</p>
                            {pillar.description && (
                              <p style={{ marginTop: "2px", fontSize: "13px", color: "#BDBDBD" }}>{pillar.description}</p>
                            )}
                            {pillar.example_topics?.length > 0 && (
                              <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                {pillar.example_topics.map((t: string) => (
                                  <span
                                    key={t}
                                    style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "999px", padding: "2px 10px", fontSize: "11px", color: "#BDBDBD" }}
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <form action={deletePillar}>
                            <input type="hidden" name="pillar_id" value={pillar.id} />
                            <input type="hidden" name="client_id" value={id} />
                            <button
                              type="submit"
                              style={{ marginLeft: "16px", flexShrink: 0, fontSize: "12px", color: "#F87171", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                            >
                              Obriši
                            </button>
                          </form>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add pillar form */}
                  <details>
                    <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "#FFCC00", listStyle: "none" }}>
                      + Dodaj novi stub
                    </summary>
                    <form action={addPillar} style={{ marginTop: "12px", display: "grid", gridTemplateColumns: "1fr", gap: "12px", backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "16px" }}>
                      <input type="hidden" name="strategy_id" value={strategy.id} />
                      <input type="hidden" name="client_id" value={id} />

                      <div>
                        <label style={labelStyle}>Naziv stuba</label>
                        <input
                          name="name"
                          required
                          placeholder="Npr. Liderstvo, B2B prodaja, HR trendovi"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Opis</label>
                        <input
                          name="description"
                          placeholder="Kratki opis teme"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Primeri tema (jedan po redu)</label>
                        <textarea
                          name="example_topics"
                          rows={3}
                          placeholder={"5 grešaka koje HR direktori prave\nKako smo smanjili turnover za 40%\nZašto onboarding određuje sve"}
                          style={{ ...inputStyle, resize: "vertical" }}
                        />
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button
                          type="submit"
                          style={{ backgroundColor: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.3)", color: "#A5B4FC", borderRadius: "12px", padding: "10px 20px", fontSize: "14px", cursor: "pointer" }}
                        >
                          Dodaj stub
                        </button>
                      </div>
                    </form>
                  </details>
                </div>
              )}

              {!strategy && (
                <p style={{ marginTop: "16px", fontSize: "13px", color: "rgba(255,255,255,0.35)" }}>
                  Sačuvaj strategiju da bi dodao stubove sadržaja.
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
