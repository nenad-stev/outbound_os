"use client";

import { useState } from "react";
import { linkSenderProfile, linkCampaign, createCampaignFromHeyReach, importSenderFromHeyReach } from "@/app/actions/heyreach-setup";

interface HrAccount   { id: string | number; label: string; raw: any }
interface HrCampaign  { id: number; name: string; status: string; totalLeads: number; linkedAccountIds: number[] }
interface DbProfile   { id: string; full_name: string; linkedin_url: string | null; heyreach_account_id: string | null; client_id: string; clients: any }
interface DbCampaign  { id: string; name: string; heyreach_campaign_id: string | null; client_id: string; clients: any }

interface Props {
  hrAccounts:  HrAccount[];
  hrCampaigns: HrCampaign[];
  dbProfiles:  DbProfile[];
  dbCampaigns: DbCampaign[];
  clients:     { id: string; name: string }[];
}

const inputStyle: React.CSSProperties = {
  backgroundColor: "#3B3B3B", border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "10px", color: "#FFFFFF", padding: "8px 12px",
  fontSize: "13px", width: "100%", outline: "none",
};
const selectStyle: React.CSSProperties = { ...inputStyle };

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      display: "inline-block", width: "7px", height: "7px", borderRadius: "50%",
      backgroundColor: ok ? "#86EFAC" : "rgba(255,255,255,0.2)",
      marginRight: "6px", flexShrink: 0,
    }} />
  );
}

export default function HeyReachSetup({ hrAccounts, hrCampaigns, dbProfiles, dbCampaigns, clients }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [newCampaignClient,  setNewCampaignClient]  = useState<Record<number, string>>({});
  const [newCampaignName,    setNewCampaignName]    = useState<Record<number, string>>({});
  const [importClient,       setImportClient]       = useState<Record<string, string>>({});

  async function submit(key: string, action: (fd: FormData) => Promise<void>, fd: FormData) {
    setBusy(key);
    try { await action(fd); } finally { setBusy(null); }
  }

  const btnStyle = (active: boolean): React.CSSProperties => ({
    backgroundColor: active ? "#FFCC00" : "rgba(255,255,255,0.06)",
    color: active ? "#272727" : "#BDBDBD",
    border: "none", borderRadius: "8px", padding: "6px 14px",
    fontSize: "12px", fontWeight: 600, cursor: active ? "pointer" : "not-allowed",
    opacity: active ? 1 : 0.5,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>

      {/* ── LinkedIn Accounts → Sender Profiles ── */}
      <section>
        <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", marginBottom: "16px" }}>
          LinkedIn nalozi → Sender profili
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
          {hrAccounts.map((acc) => {
            const linked = dbProfiles.find((p) => String(p.heyreach_account_id) === String(acc.id));
            return (
              <div key={acc.id} style={{ backgroundColor: "#303030", borderRadius: "12px", padding: "16px 20px", display: "grid", gridTemplateColumns: "200px 1fr", gap: "16px", alignItems: "start", marginBottom: "8px" }}>
                {/* HeyReach side */}
                <div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <StatusDot ok={!!linked} />
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#FFFFFF" }}>{acc.label}</span>
                  </div>
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginTop: "2px", paddingLeft: "13px" }}>
                    HeyReach ID: {acc.id}
                  </p>
                </div>

                {/* Dropdown: pick sender profile OR create new */}
                {linked ? (
                  /* Already linked — show name, offer re-link */
                  <form style={{ display: "flex", gap: "8px" }} onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    fd.set("hr_account_id", String(acc.id));
                    submit(`acc-${acc.id}`, linkSenderProfile, fd);
                  }}>
                    <input type="hidden" name="hr_account_id" value={String(acc.id)} />
                    <select name="profile_id" style={selectStyle} defaultValue={linked.id}>
                      <option value="">— ukloni vezu —</option>
                      {dbProfiles.map((p) => (
                        <option key={p.id} value={p.id}>{p.full_name} ({(p.clients as any)?.name ?? "?"})</option>
                      ))}
                    </select>
                    <button type="submit" disabled={busy === `acc-${acc.id}`} style={btnStyle(busy !== `acc-${acc.id}`)}>
                      {busy === `acc-${acc.id}` ? "…" : "Izmeni"}
                    </button>
                  </form>
                ) : (
                  /* Not linked — import or link to existing */
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {dbProfiles.length > 0 && (
                      <form style={{ display: "flex", gap: "8px" }} onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        fd.set("hr_account_id", String(acc.id));
                        submit(`acc-link-${acc.id}`, linkSenderProfile, fd);
                      }}>
                        <input type="hidden" name="hr_account_id" value={String(acc.id)} />
                        <select name="profile_id" style={selectStyle}>
                          <option value="">— poveži postojećeg —</option>
                          {dbProfiles.map((p) => (
                            <option key={p.id} value={p.id}>{p.full_name} ({(p.clients as any)?.name ?? "?"})</option>
                          ))}
                        </select>
                        <button type="submit" disabled={busy === `acc-link-${acc.id}`} style={btnStyle(busy !== `acc-link-${acc.id}`)}>
                          {busy === `acc-link-${acc.id}` ? "…" : "Poveži"}
                        </button>
                      </form>
                    )}

                    {/* Import as new sender */}
                    <form style={{ display: "flex", gap: "8px", alignItems: "center" }} onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      submit(`acc-import-${acc.id}`, importSenderFromHeyReach, fd);
                    }}>
                      <input type="hidden" name="hr_account_id" value={String(acc.id)} />
                      <input type="hidden" name="full_name" value={acc.label} />
                      <input type="hidden" name="linkedin_url" value={acc.raw?.profileUrl ?? ""} />
                      <select
                        name="client_id"
                        style={{ ...selectStyle, flex: 1 }}
                        value={importClient[String(acc.id)] ?? clients[0]?.id ?? ""}
                        onChange={(e) => setImportClient((p) => ({ ...p, [String(acc.id)]: e.target.value }))}
                      >
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <button type="submit" disabled={busy === `acc-import-${acc.id}`}
                        style={{ ...btnStyle(busy !== `acc-import-${acc.id}`), whiteSpace: "nowrap" as const }}>
                        {busy === `acc-import-${acc.id}` ? "…" : `+ Uvezi "${acc.label}"`}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
          {hrAccounts.length === 0 && (
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)" }}>Nema LinkedIn naloga u HeyReach-u.</p>
          )}
        </div>
      </section>

      {/* ── HeyReach Campaigns → App Campaigns ── */}
      <section>
        <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", marginBottom: "16px" }}>
          HeyReach kampanje → App kampanje
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {hrCampaigns.map((hc) => {
            const linked = dbCampaigns.find((c) => String(c.heyreach_campaign_id) === String(hc.id));
            const clientVal   = newCampaignClient[hc.id] ?? clients[0]?.id ?? "";
            const nameVal     = newCampaignName[hc.id]   ?? hc.name;

            return (
              <div key={hc.id} style={{ backgroundColor: "#303030", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "20px" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                  <StatusDot ok={!!linked} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: "#FFFFFF", margin: 0 }}>{hc.name}</p>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>
                      ID {hc.id} · {hc.status} · {hc.totalLeads} leadova
                    </p>
                  </div>
                  {linked && (
                    <span style={{ fontSize: "11px", backgroundColor: "rgba(134,239,172,0.1)", color: "#86EFAC", borderRadius: "999px", padding: "3px 10px" }}>
                      ✓ {linked.name}
                    </span>
                  )}
                </div>

                {linked ? (
                  /* Already linked — offer re-linking */
                  <form style={{ display: "flex", gap: "10px", alignItems: "center" }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      submit(`hc-link-${hc.id}`, linkCampaign, fd);
                    }}>
                    <input type="hidden" name="hr_campaign_id" value={String(hc.id)} />
                    <select name="campaign_id" style={{ ...selectStyle, flex: 1 }} defaultValue={linked.id}>
                      <option value="">— ukloni vezu —</option>
                      {dbCampaigns.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({(c.clients as any)?.name ?? "?"})</option>
                      ))}
                    </select>
                    <button type="submit" disabled={busy === `hc-link-${hc.id}`} style={btnStyle(busy !== `hc-link-${hc.id}`)}>
                      {busy === `hc-link-${hc.id}` ? "…" : "Izmeni"}
                    </button>
                  </form>
                ) : (
                  /* Not linked — two options */
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {/* Option A: link to existing app campaign */}
                    {dbCampaigns.length > 0 && (
                      <form style={{ display: "flex", gap: "10px", alignItems: "center" }}
                        onSubmit={(e) => {
                          e.preventDefault();
                          const fd = new FormData(e.currentTarget);
                          submit(`hc-link-${hc.id}`, linkCampaign, fd);
                        }}>
                        <input type="hidden" name="hr_campaign_id" value={String(hc.id)} />
                        <select name="campaign_id" style={{ ...selectStyle, flex: 1 }}>
                          <option value="">— poveži sa postojećom —</option>
                          {dbCampaigns.map((c) => (
                            <option key={c.id} value={c.id}>{c.name} ({(c.clients as any)?.name ?? "?"})</option>
                          ))}
                        </select>
                        <button type="submit" disabled={busy === `hc-link-${hc.id}`} style={btnStyle(busy !== `hc-link-${hc.id}`)}>
                          {busy === `hc-link-${hc.id}` ? "…" : "Poveži"}
                        </button>
                      </form>
                    )}

                    {/* Option B: create new app campaign */}
                    <form style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "10px", alignItems: "center" }}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        submit(`hc-create-${hc.id}`, createCampaignFromHeyReach, fd);
                      }}>
                      <input type="hidden" name="hr_campaign_id" value={String(hc.id)} />
                      <input
                        name="name" value={nameVal}
                        onChange={(e) => setNewCampaignName((p) => ({ ...p, [hc.id]: e.target.value }))}
                        placeholder="Naziv kampanje"
                        style={inputStyle}
                      />
                      <select
                        name="client_id" value={clientVal}
                        onChange={(e) => setNewCampaignClient((p) => ({ ...p, [hc.id]: e.target.value }))}
                        style={selectStyle}
                      >
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <button type="submit" disabled={busy === `hc-create-${hc.id}`} style={btnStyle(busy !== `hc-create-${hc.id}`)}>
                        {busy === `hc-create-${hc.id}` ? "…" : "Kreiraj novu"}
                      </button>
                    </form>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>
                      Gornji red: poveži sa postojećom kampanjom · Donji red: napravi novu kampanju u bazi
                    </p>
                  </div>
                )}
              </div>
            );
          })}
          {hrCampaigns.length === 0 && (
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)" }}>Nema kampanja u HeyReach-u.</p>
          )}
        </div>
      </section>
    </div>
  );
}
