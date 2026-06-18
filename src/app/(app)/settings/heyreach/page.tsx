import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getLinkedInAccounts } from "@/lib/heyreach";
import HeyReachSetup from "./HeyReachSetup";
import ImportButton from "./ImportButton";

const BASE = (process.env.HEYREACH_BASE_URL ?? "https://api.heyreach.io/api/public").replace(/\/$/, "");
const KEY  = (process.env.HEYREACH_API_KEY ?? "").trim();

async function hrGet(path: string, body?: unknown) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: body !== undefined ? "POST" : "GET",
      headers: { "X-API-KEY": KEY, "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    return res.ok ? res.json() : null;
  } catch { return null; }
}

export default async function HeyReachSettingsPage() {
  await requireUser();
  const supabase = await createClient();

  const [hrAccountsRaw, hrCampaignsRaw, dbProfilesRes, dbCampaignsRes, clientsRes] = await Promise.all([
    getLinkedInAccounts().catch(() => []),
    hrGet("/campaign/GetAll", { offset: 0, limit: 100 }),
    supabase.from("sender_profiles").select("id, full_name, linkedin_url, heyreach_account_id, client_id, clients(name)").order("full_name"),
    supabase.from("campaigns").select("id, name, heyreach_campaign_id, client_id, clients(name)").order("name"),
    supabase.from("clients").select("id, name").order("name"),
  ]);

  const hrCampaigns = (hrCampaignsRaw?.items ?? []).map((c: any) => ({
    id:             c.id as number,
    name:           c.name as string,
    status:         c.status as string,
    totalLeads:     (c.progressStats?.totalUsers ?? 0) as number,
    linkedAccountIds: (c.campaignAccountIds ?? []) as number[],
  }));

  return (
    <div>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#FFFFFF", margin: 0 }}>HeyReach Setup</h1>
        <p style={{ fontSize: "13px", color: "#BDBDBD", marginTop: "4px" }}>
          Poveži LinkedIn naloge i kampanje iz HeyReach-a sa profilima u bazi.
        </p>
      </div>

      {/* API status */}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: "8px",
        backgroundColor: KEY ? "rgba(134,239,172,0.08)" : "rgba(239,68,68,0.08)",
        border: `1px solid ${KEY ? "rgba(134,239,172,0.2)" : "rgba(239,68,68,0.2)"}`,
        borderRadius: "10px", padding: "8px 14px", marginBottom: "32px",
      }}>
        <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: KEY ? "#86EFAC" : "#F87171", display: "inline-block" }} />
        <span style={{ fontSize: "12px", color: KEY ? "#86EFAC" : "#F87171", fontWeight: 600 }}>
          {KEY ? `API key aktivan · ${hrAccountsRaw.length} nalog${hrAccountsRaw.length !== 1 ? "a" : ""} · ${hrCampaigns.length} kampanj${hrCampaigns.length !== 1 ? "a" : "a"}` : "HEYREACH_API_KEY nije postavljen"}
        </span>
      </div>

      <ImportButton clients={(clientsRes.data ?? []) as any[]} />

      <HeyReachSetup
        hrAccounts={hrAccountsRaw}
        hrCampaigns={hrCampaigns}
        dbProfiles={(dbProfilesRes.data ?? []) as any[]}
        dbCampaigns={(dbCampaignsRes.data ?? []) as any[]}
        clients={(clientsRes.data ?? []) as any[]}
      />
    </div>
  );
}
