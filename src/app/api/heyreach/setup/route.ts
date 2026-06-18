import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLinkedInAccounts, getCampaignLeads } from "@/lib/heyreach";

const BASE = (process.env.HEYREACH_BASE_URL ?? "https://api.heyreach.io/api/public").replace(/\/$/, "");
const KEY  = (process.env.HEYREACH_API_KEY ?? "").trim();

async function hr(path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: body !== undefined ? "POST" : "GET",
    headers: { "X-API-KEY": KEY, "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return json;
}

export async function GET() {
  const supabase = await createClient();

  const [hrAccountsRes, hrCampaignsRes, dbProfilesRes, dbCampaignsRes] = await Promise.allSettled([
    getLinkedInAccounts(),
    hr("/campaign/GetAll", { offset: 0, limit: 100 }),
    supabase.from("sender_profiles").select("id, full_name, linkedin_url, heyreach_account_id, client_id, clients(name)"),
    supabase.from("campaigns").select("id, name, heyreach_campaign_id, client_id, clients(name)"),
  ]);

  const hrAccounts = hrAccountsRes.status === "fulfilled" ? hrAccountsRes.value : [];
  const hrCampaigns = hrCampaignsRes.status === "fulfilled"
    ? (hrCampaignsRes.value?.items ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        totalLeads: c.progressStats?.totalUsers ?? 0,
        linkedAccountIds: c.campaignAccountIds ?? [],
      }))
    : [];
  const dbProfiles  = dbProfilesRes.status === "fulfilled"  ? (dbProfilesRes.value.data  ?? []) : [];
  const dbCampaigns = dbCampaignsRes.status === "fulfilled" ? (dbCampaignsRes.value.data ?? []) : [];

  return NextResponse.json({ hrAccounts, hrCampaigns, dbProfiles, dbCampaigns });
}
