// Imports all leads from HeyReach campaigns into our DB.
// Creates: companies (if any), people, lead_assignments, connection_status.
// Safe to run multiple times — upserts on linkedin_url dedup key.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { linkedinKey } from "@/lib/enrichment";
import {
  getCampaignLeads,
  extractLeadProfileUrl,
  extractLiAccountId,
  extractLeadSignal,
} from "@/lib/heyreach";

export const maxDuration = 60;

function domainFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase() || null;
  } catch { return null; }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  const supabase = await createClient();

  // Load campaigns that belong to this client and have a HeyReach campaign ID
  const { data: campaigns, error: cErr } = await supabase
    .from("campaigns")
    .select("id, heyreach_campaign_id")
    .eq("client_id", clientId)
    .not("heyreach_campaign_id", "is", null);

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (!campaigns?.length) {
    return NextResponse.json({ error: "Nema kampanja sa HeyReach campaign ID za ovog klijenta." }, { status: 400 });
  }

  // Load sender profiles for account-id → profile-id mapping
  const { data: senderProfiles } = await supabase
    .from("sender_profiles")
    .select("id, heyreach_account_id")
    .eq("client_id", clientId)
    .not("heyreach_account_id", "is", null);

  const senderByHrId = new Map<string, string>();
  for (const sp of senderProfiles ?? []) {
    if (sp.heyreach_account_id) senderByHrId.set(String(sp.heyreach_account_id), sp.id);
  }

  const stats = { fetched: 0, people: 0, assignments: 0, skipped: 0, errors: 0 };
  const errs: string[] = [];

  for (const campaign of campaigns) {
    let leads: any[];
    try {
      leads = await getCampaignLeads(campaign.heyreach_campaign_id!, 5000);
    } catch (e: any) {
      errs.push(`Campaign ${campaign.heyreach_campaign_id}: ${e.message}`);
      continue;
    }
    stats.fetched += leads.length;

    for (const lead of leads) {
      try {
        const profile = lead.linkedInUserProfile ?? {};
        const profileUrl = extractLeadProfileUrl(lead);
        if (!profileUrl) { stats.skipped++; continue; }

        const hrSenderId   = extractLiAccountId(lead);
        const senderProfileId = hrSenderId ? (senderByHrId.get(String(hrSenderId)) ?? null) : null;
        const sig = extractLeadSignal(lead);

        // ── 1. Company (optional) ──────────────────────────────────────
        let companyId: string | null = null;
        const companyName = profile.companyName as string | null;
        const companyUrl  = profile.companyUrl  as string | null;
        const domain      = domainFromUrl(companyUrl);

        if (companyName || domain) {
          const { data: co } = await supabase
            .from("companies")
            .upsert(
              { name: companyName ?? domain, domain, linkedin_company_url: companyUrl ?? null },
              { onConflict: "domain", ignoreDuplicates: false }
            )
            .select("id")
            .maybeSingle();
          companyId = co?.id ?? null;

          // if domain conflict, fetch existing row
          if (!companyId && domain) {
            const { data: existing } = await supabase
              .from("companies")
              .select("id")
              .ilike("domain", domain)
              .maybeSingle();
            companyId = existing?.id ?? null;
          }
        }

        // ── 2. Person — check-then-insert (functional unique index prevents ON CONFLICT) ──
        const normalUrl = profileUrl.replace(/\/$/, "");
        const { data: existingPerson } = await supabase
          .from("people")
          .select("id")
          .ilike("linkedin_url", normalUrl)
          .maybeSingle();

        let personId: string;
        if (existingPerson) {
          personId = existingPerson.id;
          if (companyId) await supabase.from("people").update({ company_id: companyId }).eq("id", personId);
        } else {
          const { data: created, error: pErr } = await supabase
            .from("people")
            .insert({
              linkedin_url: normalUrl,
              first_name:   profile.firstName  ?? null,
              last_name:    profile.lastName   ?? null,
              full_name:    `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() || null,
              title:        profile.headline   ?? null,
              company_id:   companyId,
              enrichment: {
                image_url:   profile.imageUrl  ?? null,
                location:    profile.location  ?? null,
                linkedin_id: profile.linkedin_id ?? null,
              },
            })
            .select("id")
            .maybeSingle();
          if (pErr || !created) { stats.errors++; errs.push(`Person insert: ${pErr?.message}`); continue; }
          personId = created.id;
          stats.people++;
        }

        await upsertAssignment(supabase, { personId, companyId, clientId, campaignId: campaign.id, senderProfileId, sig, stats });
      } catch (e: any) {
        stats.errors++;
        errs.push(e.message?.slice(0, 120));
      }
    }
  }

  return NextResponse.json({ ...stats, ...(errs.length ? { errors_detail: errs.slice(0, 20) } : {}) });
}

async function upsertAssignment(supabase: any, {
  personId, companyId, clientId, campaignId, senderProfileId, sig, stats,
}: {
  personId: string; companyId: string | null; clientId: string;
  campaignId: string; senderProfileId: string | null;
  sig: { connected: boolean; replied: boolean; declined: boolean };
  stats: any;
}) {
  // Determine assignment status
  const status = sig.replied ? "replied"
    : sig.connected ? "active"
    : "pushed";

  // Upsert lead_assignment (unique per person + client)
  const { data: existing } = await supabase
    .from("lead_assignments")
    .select("id, status")
    .eq("person_id", personId)
    .eq("client_id", clientId)
    .maybeSingle();

  let assignmentId: string;

  if (existing) {
    // Only update status if it's progressing forward
    const order = ["pending_review", "approved", "pushed", "active", "replied", "completed"];
    const existingRank = order.indexOf(existing.status);
    const newRank = order.indexOf(status);
    if (newRank > existingRank) {
      await supabase.from("lead_assignments").update({ status, updated_at: new Date().toISOString() }).eq("id", existing.id);
    }
    assignmentId = existing.id;
  } else {
    const { data: created } = await supabase
      .from("lead_assignments")
      .insert({
        person_id:         personId,
        company_id:        companyId,
        client_id:         clientId,
        campaign_id:       campaignId,
        sender_profile_id: senderProfileId,
        status,
      })
      .select("id")
      .maybeSingle();

    if (!created) return;
    assignmentId = created.id;
    stats.assignments++;
  }

  // Upsert connection_status
  const connState = sig.declined ? "declined"
    : sig.connected ? "accepted"
    : "requested";

  await supabase.from("connection_status").upsert(
    {
      lead_assignment_id: assignmentId,
      state: connState,
      ...(connState === "accepted" ? { accepted_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "lead_assignment_id" }
  );
}
