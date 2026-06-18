import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { linkedinKey } from "@/lib/enrichment";
import { getCampaignLeads, extractLeadProfileUrl, extractLeadSignal } from "@/lib/heyreach";

export const maxDuration = 60;

// Change event returned per person so n8n / Discord / Attio can act on specifics
export interface ChangeEvent {
  event:        "connected" | "replied" | "declined";
  person_name:  string;
  linkedin_url: string;
  title:        string | null;
  company_name: string | null;
  campaign_name: string | null;
  client_id:    string;
}

function supabaseForRequest(req: NextRequest) {
  // n8n (and other internal callers) pass X-Sync-Secret instead of a browser cookie
  const secret = req.headers.get("x-sync-secret");
  if (secret && secret === process.env.SYNC_SECRET) {
    return createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  // Normal browser session path
  return createClient();
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  const debug = req.nextUrl.searchParams.get("debug") === "1";

  const supabase = await supabaseForRequest(req);

  const { data: rows, error } = await supabase
    .from("lead_assignments")
    .select(`
      id, status,
      people(linkedin_url, full_name, title, companies(name)),
      campaigns(heyreach_campaign_id, name),
      connection_status(state, accepted_at)
    `)
    .eq("client_id", clientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const assignments = (rows ?? []) as any[];
  const first = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

  const campaignIds = [
    ...new Set(
      assignments
        .map((a) => first<any>(a.campaigns)?.heyreach_campaign_id)
        .filter(Boolean) as string[]
    ),
  ];

  if (campaignIds.length === 0) {
    return NextResponse.json({ error: "Nijedna kampanja ovog klijenta nema HeyReach campaign ID." }, { status: 400 });
  }

  const leadByUrl = new Map<string, any>();
  let leadsFetched = 0;
  let debugSample: any = null;
  const campaignErrors: string[] = [];

  for (const cid of campaignIds) {
    try {
      const leads = await getCampaignLeads(cid);
      leadsFetched += leads.length;
      if (debug && !debugSample && leads.length) debugSample = leads[0];
      for (const lead of leads) {
        const url = extractLeadProfileUrl(lead);
        const key = linkedinKey(url);
        if (key) leadByUrl.set(key, lead);
      }
    } catch (e: any) {
      campaignErrors.push(`${cid}: ${e.message}`);
    }
  }

  let matched = 0, updated = 0, accepted = 0, replied = 0;
  const changes: ChangeEvent[] = [];

  for (const a of assignments) {
    const person = first<any>(a.people);
    const url = person?.linkedin_url;
    const key = linkedinKey(url);
    if (!key) continue;
    const lead = leadByUrl.get(key);
    if (!lead) continue;
    matched++;

    const sig = extractLeadSignal(lead);
    const cs  = first<any>(a.connection_status);
    const campaign = first<any>(a.campaigns);
    const company  = first<any>(person?.companies);

    const meta: Omit<ChangeEvent, "event"> = {
      person_name:  person?.full_name ?? url ?? "—",
      linkedin_url: url,
      title:        person?.title ?? null,
      company_name: company?.name ?? null,
      campaign_name: campaign?.name ?? null,
      client_id:    clientId,
    };

    // Connection state
    let newState: string | null = null;
    if (sig.declined) newState = "declined";
    else if (sig.connected) newState = "accepted";

    if (newState && newState !== cs?.state) {
      await supabase.from("connection_status").upsert(
        {
          lead_assignment_id: a.id,
          state: newState,
          ...(newState === "accepted" && !cs?.accepted_at ? { accepted_at: new Date().toISOString() } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "lead_assignment_id" }
      );
      if (newState === "accepted") {
        accepted++;
        changes.push({ event: "connected", ...meta });
      }
      if (newState === "declined") {
        changes.push({ event: "declined", ...meta });
      }
    }

    // Assignment status
    let newStatus: string | null = null;
    if (sig.replied) { newStatus = "replied"; }
    else if (sig.connected) { newStatus = "active"; }

    if (newStatus && newStatus !== a.status) {
      await supabase
        .from("lead_assignments")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", a.id);
      updated++;
      if (sig.replied && a.status !== "replied") {
        replied++;
        changes.push({ event: "replied", ...meta });
      }
    }
  }

  return NextResponse.json({
    campaigns: campaignIds.length,
    leadsFetched,
    assignments: assignments.length,
    matched,
    updated,
    accepted,
    replied,
    changes,
    ...(campaignErrors.length ? { campaignErrors } : {}),
    ...(debug ? { debugSampleKeys: debugSample ? Object.keys(debugSample) : [], debugSample } : {}),
  });
}
