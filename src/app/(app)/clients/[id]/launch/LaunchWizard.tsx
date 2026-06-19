"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createLaunchCampaign, createLaunchAudience, attachLaunchAudience, type LaunchStepInput } from "@/app/actions/launch";
import type { PersonalizationLevel, SequenceChannel } from "@/lib/types";
import ApolloSearchClient from "../audiences/apollo/ApolloSearchClient";

interface Campaign { id: string; name: string; heyreach_campaign_id: string | null; sender_profile_id: string | null; step_count: number }
interface Sender { id: string; name: string; heyreach_account_id: string | null }
interface Icp { id: string; name: string; is_default: boolean }
interface Audience { id: string; name: string; row_count: number; campaign_id: string | null }

const STEPS = ["Kampanja", "Identitet & ICP", "Publika", "Obrada", "Pregled"];
const CHANNELS: { value: SequenceChannel; label: string }[] = [
  { value: "connection_request", label: "Connection request" },
  { value: "message", label: "Poruka" },
  { value: "inmail", label: "InMail" },
];

const inputStyle: React.CSSProperties = {
  backgroundColor: "#272727", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px",
  color: "#FFFFFF", padding: "9px 11px", fontSize: "13px", width: "100%", outline: "none",
};
const labelStyle: React.CSSProperties = { fontSize: "12px", fontWeight: 600, color: "#BDBDBD", marginBottom: "5px", display: "block" };
const cardStyle: React.CSSProperties = {
  backgroundColor: "#303030", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "24px",
};

function Stepper({ current }: { current: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "24px", flexWrap: "wrap" }}>
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "7px",
              backgroundColor: active ? "#FFCC00" : done ? "rgba(134,239,172,0.12)" : "rgba(255,255,255,0.05)",
              color: active ? "#272727" : done ? "#86EFAC" : "rgba(255,255,255,0.45)",
              borderRadius: "999px", padding: "5px 13px", fontSize: "12px", fontWeight: 600,
              border: active ? "1px solid #FFCC00" : done ? "1px solid rgba(134,239,172,0.3)" : "1px solid rgba(255,255,255,0.08)",
            }}>
              <span style={{
                width: "18px", height: "18px", borderRadius: "999px", display: "inline-flex", alignItems: "center", justifyContent: "center",
                backgroundColor: active ? "rgba(0,0,0,0.15)" : done ? "rgba(134,239,172,0.2)" : "rgba(255,255,255,0.08)", fontSize: "11px",
              }}>{done ? "✓" : i + 1}</span>
              {label}
            </span>
            {i < STEPS.length - 1 && <span style={{ color: "rgba(255,255,255,0.2)" }}>→</span>}
          </span>
        );
      })}
    </div>
  );
}

function NavButtons({ onBack, onNext, nextLabel, nextDisabled, busy }: {
  onBack?: () => void; onNext: () => void; nextLabel: string; nextDisabled?: boolean; busy?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "24px" }}>
      {onBack ? (
        <button onClick={onBack} disabled={busy}
          style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", color: "#BDBDBD", borderRadius: "10px", padding: "9px 18px", fontSize: "13px", cursor: busy ? "default" : "pointer" }}>
          ← Nazad
        </button>
      ) : <span />}
      <button onClick={onNext} disabled={nextDisabled || busy}
        style={{ backgroundColor: "#FFCC00", color: "#272727", fontWeight: 600, borderRadius: "10px", padding: "9px 22px", fontSize: "14px", border: "none", cursor: nextDisabled || busy ? "not-allowed" : "pointer", opacity: nextDisabled || busy ? 0.5 : 1 }}>
        {busy ? "Sačekaj…" : nextLabel}
      </button>
    </div>
  );
}

function Err({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p style={{ fontSize: "13px", color: "#F87171", marginTop: "12px", padding: "8px 12px", backgroundColor: "rgba(248,113,113,0.08)", borderRadius: "8px" }}>{msg}</p>;
}

export default function LaunchWizard({ clientId, campaigns, senders, icps, audiences }: {
  clientId: string; campaigns: Campaign[]; senders: Sender[]; icps: Icp[]; audiences: Audience[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 0 — campaign
  const [campMode, setCampMode] = useState<"existing" | "new">(campaigns.length ? "existing" : "new");
  const [existingCampaignId, setExistingCampaignId] = useState(campaigns[0]?.id ?? "");
  const [newName, setNewName] = useState("");
  const [newLevel, setNewLevel] = useState<PersonalizationLevel>("light");
  const [newHeyreachId, setNewHeyreachId] = useState("");
  const [newSteps, setNewSteps] = useState<LaunchStepInput[]>([
    { channel: "connection_request", template_text: "", delay_days: 0 },
    { channel: "message", template_text: "", delay_days: 3 },
  ]);

  // Resolved across steps
  const [campaignId, setCampaignId] = useState<string>("");
  const [senderId, setSenderId] = useState<string>("");
  const [icpId, setIcpId] = useState<string>(icps.find((i) => i.is_default)?.id ?? icps[0]?.id ?? "");

  // Step 2 — audience
  const [audMode, setAudMode] = useState<"apollo" | "csv" | "heyreach" | "existing">("apollo");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [existingAudienceId, setExistingAudienceId] = useState(audiences[0]?.id ?? "");
  const [audienceId, setAudienceId] = useState<string>("");
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  // HeyReach import tab
  const [hrCampaignId, setHrCampaignId] = useState("");
  const [hrAudienceName, setHrAudienceName] = useState("");
  const [hrBusy, setHrBusy] = useState(false);
  const [hrError, setHrError] = useState<string | null>(null);

  // Step 3 — pipeline
  const [pipeResult, setPipeResult] = useState<{ qualified: number; disqualified: number; noData: number } | null>(null);

  const resolvedCampaign = campaigns.find((c) => c.id === campaignId);
  const resolvedSender = senders.find((s) => s.id === senderId);

  function updateStep(i: number, patch: Partial<LaunchStepInput>) {
    setNewSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addStep() {
    setNewSteps((prev) => [...prev, { channel: "message", template_text: "", delay_days: 3 }]);
  }
  function removeStep(i: number) {
    setNewSteps((prev) => prev.filter((_, idx) => idx !== i));
  }

  // ---- Step transitions ----
  async function submitStep0() {
    setError(null);
    if (campMode === "existing") {
      if (!existingCampaignId) { setError("Izaberi kampanju."); return; }
      const c = campaigns.find((x) => x.id === existingCampaignId);
      if (c && c.step_count === 0) { setError("Ova kampanja nema sequence poruke. Dodaj ih u Campaigns ili napravi novu."); return; }
      setCampaignId(existingCampaignId);
      if (c?.sender_profile_id) setSenderId(c.sender_profile_id);
      setStep(1);
      return;
    }
    // new campaign
    setBusy(true);
    const res = await createLaunchCampaign(clientId, {
      name: newName,
      personalization_level: newLevel,
      heyreach_campaign_id: newHeyreachId.trim() || null,
      sender_profile_id: senderId || null,
      steps: newSteps,
    });
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    setCampaignId(res.id!);
    setStep(1);
  }

  function submitStep1() {
    setError(null);
    if (!senderId) { setError("Izaberi identitet (sender)."); return; }
    if (!icpId) { setError("Izaberi ICP profil."); return; }
    setStep(2);
  }

  // Apollo import happens inside the embedded UI; wire sender then record the audience.
  async function onApolloImported(importedAudienceId: string, importedTotal: number) {
    setError(null);
    await attachLaunchAudience(importedAudienceId, campaignId, senderId, icpId);
    setAudienceId(importedAudienceId);
    setAudienceCount(importedTotal);
  }

  async function importFromHeyReach() {
    setHrError(null);
    if (!hrCampaignId.trim()) { setHrError("Unesi HeyReach campaign ID."); return; }
    setHrBusy(true);
    try {
      const res = await fetch("/api/heyreach/audience-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heyreach_campaign_id: hrCampaignId.trim(),
          audience_name: hrAudienceName.trim() || `HeyReach #${hrCampaignId.trim()}`,
          client_id: clientId,
          campaign_id: campaignId,
          sender_profile_id: senderId || null,
          icp_profile_id: icpId,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setHrError(data.error ?? "Import nije uspeo."); return; }
      setAudienceId(data.audience_id);
      setAudienceCount(data.count);
    } catch (e: any) {
      setHrError(e.message);
    } finally {
      setHrBusy(false);
    }
  }

  async function submitStep2() {
    setError(null);
    if (audMode === "apollo") {
      if (!audienceId) { setError("Importuj bar jedan Apollo search pre nego nastaviš."); return; }
      setStep(3);
      return;
    }
    if (audMode === "heyreach") {
      if (!audienceId) { setError("Importuj HeyReach kampanju pre nego nastaviš."); return; }
      setStep(3);
      return;
    }
    if (audMode === "existing") {
      if (!existingAudienceId) { setError("Izaberi publiku."); return; }
      setBusy(true);
      const res = await attachLaunchAudience(existingAudienceId, campaignId, senderId, icpId);
      setBusy(false);
      if (res.error) { setError(res.error); return; }
      setAudienceId(res.id!);
      setAudienceCount(audiences.find((a) => a.id === existingAudienceId)?.row_count ?? null);
      setStep(3);
      return;
    }
    // CSV
    if (!csvFile) { setError("Uploaduj CSV fajl."); return; }
    setBusy(true);
    const fd = new FormData();
    fd.append("campaign_id", campaignId);
    fd.append("sender_profile_id", senderId);
    fd.append("icp_profile_id", icpId);
    fd.append("csv_file", csvFile);
    const res = await createLaunchAudience(clientId, fd);
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    setAudienceId(res.id!);
    setAudienceCount(res.count ?? null);
    setStep(3);
  }

  async function runPipeline() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/pipeline/${audienceId}/start`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Obrada nije uspela.");
      setPipeResult({ qualified: body.qualified ?? 0, disqualified: body.disqualified ?? 0, noData: body.noData ?? 0 });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: "760px" }}>
      <Stepper current={step} />

      {/* STEP 0 — Campaign */}
      {step === 0 && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#FFFFFF", marginBottom: "4px" }}>1. Kampanja</h2>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", marginBottom: "18px" }}>
            Nastavi postojeću ili napravi novu sa sekvencom poruka.
          </p>

          <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
            {(["existing", "new"] as const).map((m) => (
              <button key={m} onClick={() => setCampMode(m)}
                disabled={m === "existing" && campaigns.length === 0}
                style={{
                  flex: 1, borderRadius: "10px", padding: "10px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                  backgroundColor: campMode === m ? "#FFCC00" : "rgba(255,255,255,0.05)",
                  color: campMode === m ? "#272727" : "#BDBDBD",
                  border: campMode === m ? "1px solid #FFCC00" : "1px solid rgba(255,255,255,0.1)",
                  opacity: m === "existing" && campaigns.length === 0 ? 0.4 : 1,
                }}>
                {m === "existing" ? "Postojeća kampanja" : "Nova kampanja"}
              </button>
            ))}
          </div>

          {campMode === "existing" ? (
            <div>
              <label style={labelStyle}>Kampanja</label>
              <select value={existingCampaignId} onChange={(e) => setExistingCampaignId(e.target.value)} style={inputStyle}>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.step_count} {c.step_count === 1 ? "poruka" : "poruka"}{!c.heyreach_campaign_id ? " · ⚠ bez HeyReach ID" : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={labelStyle}>Naziv kampanje</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="npr. Q3 Osnivači Srbija" style={inputStyle} />
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Nivo personalizacije</label>
                  <select value={newLevel} onChange={(e) => setNewLevel(e.target.value as PersonalizationLevel)} style={inputStyle}>
                    <option value="light">Light</option>
                    <option value="medium">Medium</option>
                    <option value="heavy">Heavy</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>HeyReach campaign ID <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.3)" }}>(opciono)</span></label>
                  <input value={newHeyreachId} onChange={(e) => setNewHeyreachId(e.target.value)} placeholder="npr. 12345" style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Sekvenca poruka</label>
                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginBottom: "10px" }}>
                  Koristi {"{first_name}"}, {"{company}"} i [uglaste zagrade] gde AI treba da napiše personalizovan deo.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {newSteps.map((s, i) => (
                    <div key={i} style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#A5B4FC" }}>{i + 1}.</span>
                        <select value={s.channel} onChange={(e) => updateStep(i, { channel: e.target.value as SequenceChannel })}
                          style={{ ...inputStyle, width: "auto", padding: "5px 8px", fontSize: "12px" }}>
                          {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>delay</span>
                        <input type="number" min={0} value={s.delay_days} onChange={(e) => updateStep(i, { delay_days: Number(e.target.value) })}
                          style={{ ...inputStyle, width: "62px", padding: "5px 8px", fontSize: "12px" }} />
                        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>dana</span>
                        {newSteps.length > 1 && (
                          <button onClick={() => removeStep(i)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#F87171", cursor: "pointer", fontSize: "12px" }}>Ukloni</button>
                        )}
                      </div>
                      <textarea value={s.template_text} onChange={(e) => updateStep(i, { template_text: e.target.value })} rows={3}
                        placeholder={s.channel === "connection_request" ? "Zdravo {first_name}, [razlog za konekciju]…" : "Zdravo {first_name}, vidim da [personalizovan uvod]…"}
                        style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
                    </div>
                  ))}
                </div>
                <button onClick={addStep} style={{ marginTop: "10px", background: "none", border: "1px dashed rgba(255,255,255,0.2)", color: "#BDBDBD", borderRadius: "8px", padding: "8px 14px", fontSize: "12px", cursor: "pointer" }}>
                  + Dodaj korak
                </button>
              </div>
            </div>
          )}

          <Err msg={error} />
          <NavButtons onNext={submitStep0} nextLabel={campMode === "new" ? "Napravi i nastavi →" : "Nastavi →"} busy={busy} />
        </div>
      )}

      {/* STEP 1 — Identity & ICP */}
      {step === 1 && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#FFFFFF", marginBottom: "4px" }}>2. Identitet & ICP</h2>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", marginBottom: "18px" }}>
            Sa kog LinkedIn naloga se šalje i koji ICP se koristi za kvalifikaciju.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={labelStyle}>Identitet (sender)</label>
              {senders.length === 0 ? (
                <p style={{ fontSize: "13px", color: "#F87171" }}>
                  Nema sender profila. <Link href={`/clients/${clientId}/profiles/new`} style={{ color: "#FFCC00" }}>Dodaj sender →</Link>
                </p>
              ) : (
                <select value={senderId} onChange={(e) => setSenderId(e.target.value)} style={inputStyle}>
                  <option value="">— Izaberi —</option>
                  {senders.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}{!s.heyreach_account_id ? " · ⚠ bez HeyReach account ID" : ""}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label style={labelStyle}>ICP profil</label>
              {icps.length === 0 ? (
                <p style={{ fontSize: "13px", color: "#F87171" }}>
                  Nema ICP profila. <Link href={`/clients/${clientId}/icp/new`} style={{ color: "#FFCC00" }}>Dodaj ICP →</Link>
                </p>
              ) : (
                <select value={icpId} onChange={(e) => setIcpId(e.target.value)} style={inputStyle}>
                  <option value="">— Izaberi —</option>
                  {icps.map((i) => <option key={i.id} value={i.id}>{i.name}{i.is_default ? " (default)" : ""}</option>)}
                </select>
              )}
            </div>
          </div>

          <Err msg={error} />
          <NavButtons onBack={() => setStep(0)} onNext={submitStep1} nextLabel="Nastavi →" />
        </div>
      )}

      {/* STEP 2 — Audience */}
      {step === 2 && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#FFFFFF", marginBottom: "4px" }}>3. Publika</h2>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", marginBottom: "18px" }}>
            Uvezi nove leadove (CSV ili Apollo) ili izaberi već importovanu publiku.
          </p>

          <div style={{ display: "flex", gap: "8px", marginBottom: "18px", flexWrap: "wrap" }}>
            {(["apollo", "csv", "heyreach", "existing"] as const).map((m) => (
              <button key={m} onClick={() => { setAudMode(m); setError(null); setHrError(null); setAudienceId(""); setAudienceCount(null); }}
                disabled={m === "existing" && audiences.length === 0}
                style={{
                  flex: 1, minWidth: "130px", borderRadius: "10px", padding: "10px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                  backgroundColor: audMode === m ? "#FFCC00" : "rgba(255,255,255,0.05)",
                  color: audMode === m ? "#272727" : "#BDBDBD",
                  border: audMode === m ? "1px solid #FFCC00" : "1px solid rgba(255,255,255,0.1)",
                  opacity: m === "existing" && audiences.length === 0 ? 0.4 : 1,
                }}>
                {m === "apollo" ? "Apollo search" : m === "csv" ? "Upload CSV" : m === "heyreach" ? "HeyReach" : "Postojeća publika"}
              </button>
            ))}
          </div>

          {audMode === "csv" && (
            <div>
              <label style={labelStyle}>CSV fajl (Apollo ili LGM export)</label>
              <input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                style={{ ...inputStyle, padding: "8px" }} />
              {csvFile && <p style={{ fontSize: "12px", color: "#86EFAC", marginTop: "8px" }}>✓ {csvFile.name}</p>}
            </div>
          )}

          {audMode === "heyreach" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", margin: 0 }}>
                Unesi numerički ID HeyReach kampanje iz koje želiš da uvezeh leadove. Leadovi se importuju kao nova publika i prolaze kroz dedup + pipeline.
              </p>
              {audienceId ? (
                <div style={{ padding: "12px 14px", backgroundColor: "rgba(134,239,172,0.08)", border: "1px solid rgba(134,239,172,0.2)", borderRadius: "10px" }}>
                  <p style={{ fontSize: "13px", color: "#86EFAC", margin: 0, fontWeight: 600 }}>
                    ✓ Importovano {audienceCount ?? 0} leadova iz HeyReach kampanje #{hrCampaignId}
                  </p>
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>Možeš nastaviti na obradu.</p>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>HeyReach Campaign ID</label>
                      <input
                        value={hrCampaignId}
                        onChange={(e) => setHrCampaignId(e.target.value)}
                        placeholder="npr. 98765"
                        style={inputStyle}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Naziv publike <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.3)" }}>(opciono)</span></label>
                      <input
                        value={hrAudienceName}
                        onChange={(e) => setHrAudienceName(e.target.value)}
                        placeholder={`HeyReach #${hrCampaignId || "…"}`}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  {hrError && (
                    <p style={{ fontSize: "13px", color: "#F87171", padding: "8px 12px", backgroundColor: "rgba(248,113,113,0.08)", borderRadius: "8px", margin: 0 }}>
                      {hrError}
                    </p>
                  )}
                  <button
                    onClick={importFromHeyReach}
                    disabled={hrBusy || !hrCampaignId.trim()}
                    style={{
                      alignSelf: "flex-start", backgroundColor: "#A5B4FC", color: "#272727", fontWeight: 600,
                      borderRadius: "10px", padding: "9px 20px", fontSize: "13px", border: "none",
                      cursor: hrBusy || !hrCampaignId.trim() ? "not-allowed" : "pointer",
                      opacity: hrBusy || !hrCampaignId.trim() ? 0.5 : 1,
                    }}
                  >
                    {hrBusy ? "Uvozim iz HeyReach-a…" : "Uvezi iz HeyReach-a"}
                  </button>
                </>
              )}
            </div>
          )}

          {audMode === "apollo" && (
            <div>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginBottom: "12px" }}>
                Pretraži Apollo i importuj direktno u ovu kampanju (kampanja i ICP su već izabrani). Možeš pokrenuti više searcheva.
              </p>
              {audienceId && (
                <p style={{ fontSize: "12px", color: "#86EFAC", marginBottom: "12px", padding: "8px 12px", backgroundColor: "rgba(134,239,172,0.08)", borderRadius: "8px" }}>
                  ✓ Importovano {audienceCount ?? 0} leadova — možeš nastaviti ili pokrenuti još searcheva.
                </p>
              )}
              <div style={{ backgroundColor: "rgba(0,0,0,0.2)", borderRadius: "12px", padding: "16px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <ApolloSearchClient
                  clientId={clientId}
                  campaigns={campaigns.map((c) => ({ id: c.id, name: c.name, sender_name: null }))}
                  icpProfiles={icps}
                  initialSearches={[]}
                  fixedCampaignId={campaignId}
                  fixedIcpId={icpId}
                  onImported={onApolloImported}
                />
              </div>
            </div>
          )}

          {audMode === "existing" && (
            <div>
              <label style={labelStyle}>Publika</label>
              <select value={existingAudienceId} onChange={(e) => setExistingAudienceId(e.target.value)} style={inputStyle}>
                {audiences.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.row_count} leadova</option>)}
              </select>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "8px" }}>
                Biće povezana sa izabranom kampanjom, identitetom i ICP-om.
              </p>
            </div>
          )}

          <Err msg={error} />
          <NavButtons onBack={() => setStep(1)} onNext={submitStep2}
            nextLabel={audMode === "apollo" || audMode === "heyreach" ? "Dalje: obrada →" : "Uvezi i nastavi →"}
            nextDisabled={(audMode === "apollo" || audMode === "heyreach") && !audienceId} busy={busy} />
        </div>
      )}

      {/* STEP 3 — Pipeline */}
      {step === 3 && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#FFFFFF", marginBottom: "4px" }}>4. Obrada</h2>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", marginBottom: "18px" }}>
            Kvalifikacija + enrichment + scoring{audienceCount != null ? ` za ${audienceCount} leadova` : ""}. Dedup automatski isključuje već kontaktirane.
          </p>

          {!pipeResult ? (
            <button onClick={runPipeline} disabled={busy}
              style={{ backgroundColor: "#A5B4FC", color: "#272727", fontWeight: 600, borderRadius: "10px", padding: "11px 22px", fontSize: "14px", border: "none", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}>
              {busy ? "Obrađujem… (može potrajati par minuta)" : "▶ Pokreni obradu"}
            </button>
          ) : (
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "120px", backgroundColor: "rgba(134,239,172,0.08)", border: "1px solid rgba(134,239,172,0.2)", borderRadius: "12px", padding: "14px" }}>
                <p style={{ fontSize: "24px", fontWeight: 700, color: "#86EFAC", margin: 0 }}>{pipeResult.qualified}</p>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", margin: 0 }}>qualified</p>
              </div>
              <div style={{ flex: 1, minWidth: "120px", backgroundColor: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: "12px", padding: "14px" }}>
                <p style={{ fontSize: "24px", fontWeight: 700, color: "#F87171", margin: 0 }}>{pipeResult.disqualified}</p>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", margin: 0 }}>disqualified</p>
              </div>
              <div style={{ flex: 1, minWidth: "120px", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "14px" }}>
                <p style={{ fontSize: "24px", fontWeight: 700, color: "#BDBDBD", margin: 0 }}>{pipeResult.noData}</p>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", margin: 0 }}>bez podataka</p>
              </div>
            </div>
          )}

          <Err msg={error} />
          <NavButtons onBack={() => setStep(2)} onNext={() => setStep(4)} nextLabel="Dalje: pregled →" nextDisabled={!pipeResult} busy={busy} />
        </div>
      )}

      {/* STEP 4 — Review handoff */}
      {step === 4 && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#FFFFFF", marginBottom: "4px" }}>5. Pregled & slanje</h2>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", marginBottom: "18px" }}>
            U Review Queue generiši poruke iz template-a, izedituj po leadu, approve i pushuj u HeyReach.
          </p>

          {/* Readiness reminders */}
          {(resolvedCampaign && !resolvedCampaign.heyreach_campaign_id) || (resolvedSender && !resolvedSender.heyreach_account_id) ? (
            <div style={{ marginBottom: "16px", borderRadius: "10px", padding: "10px 14px", fontSize: "12px", backgroundColor: "rgba(255,204,0,0.07)", border: "1px solid rgba(255,204,0,0.25)", color: "#E0C77A" }}>
              <span style={{ fontWeight: 600, color: "#FFCC00" }}>⚠ Pre slanja podesi:</span>
              <ul style={{ margin: "4px 0 0", paddingLeft: "18px" }}>
                {resolvedCampaign && !resolvedCampaign.heyreach_campaign_id && <li>HeyReach campaign ID na kampanji</li>}
                {resolvedSender && !resolvedSender.heyreach_account_id && <li>HeyReach account ID na sender profilu</li>}
              </ul>
            </div>
          ) : null}

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button onClick={() => router.push(`/clients/${clientId}/review?audienceId=${audienceId}`)}
              style={{ backgroundColor: "#FFCC00", color: "#272727", fontWeight: 600, borderRadius: "10px", padding: "11px 22px", fontSize: "14px", border: "none", cursor: "pointer" }}>
              Otvori Review Queue →
            </button>
            <Link href={`/clients/${clientId}/audiences/${audienceId}/members`}
              style={{ backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#BDBDBD", borderRadius: "10px", padding: "11px 22px", fontSize: "14px", textDecoration: "none" }}>
              Vidi sve članove
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
