// Fetches leads from a HeyReach campaign and imports them into an audience
// (audience + audience_members rows), so they can go through our pipeline.
// Different from /api/heyreach/import/[clientId] which syncs into people/lead_assignments.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureAppUser } from "@/lib/auth";
import { getCampaignLeads, extractLeadProfileUrl } from "@/lib/heyreach";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const meId = await ensureAppUser();
  if (!meId) return NextResponse.json({ error: "Nisi prijavljen." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const heyreachCampaignId = String(body?.heyreach_campaign_id ?? "").trim();
  const audienceName = String(body?.audience_name ?? "").trim();
  const clientId = String(body?.client_id ?? "").trim();
  const campaignId = String(body?.campaign_id ?? "").trim();
  const senderProfileId = String(body?.sender_profile_id ?? "").trim() || null;
  const icpId = String(body?.icp_profile_id ?? "").trim();

  if (!heyreachCampaignId) return NextResponse.json({ error: "HeyReach campaign ID je obavezan." }, { status: 400 });
  if (!clientId) return NextResponse.json({ error: "client_id je obavezan." }, { status: 400 });
  if (!campaignId) return NextResponse.json({ error: "campaign_id je obavezan." }, { status: 400 });
  if (!icpId) return NextResponse.json({ error: "icp_profile_id je obavezan." }, { status: 400 });

  // Fetch leads from HeyReach
  let leads: any[];
  try {
    leads = await getCampaignLeads(heyreachCampaignId, 5000);
  } catch (e: any) {
    return NextResponse.json({ error: `HeyReach greška: ${e.message}` }, { status: 502 });
  }

  if (leads.length === 0) {
    return NextResponse.json({ error: "HeyReach kampanja ne sadrži ni jedan lead." }, { status: 400 });
  }

  // Map HeyReach leads → our raw format (same shape as CSV-normalizer output)
  const rawMembers = leads.map((lead) => {
    const profile = lead?.linkedInUserProfile ?? {};
    const profileUrl = extractLeadProfileUrl(lead);
    return {
      linkedin_url: profileUrl ?? null,
      first_name: String(profile.firstName ?? "").trim() || null,
      last_name: String(profile.lastName ?? "").trim() || null,
      full_name: `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() || null,
      title: String(profile.headline ?? "").trim() || null,
      company_name: String(profile.companyName ?? "").trim() || null,
      company_linkedin_url: String(profile.companyUrl ?? "").trim() || null,
    };
  }).filter((r) => r.linkedin_url || r.full_name); // skip empty rows

  if (rawMembers.length === 0) {
    return NextResponse.json({ error: "Nisu pronađeni leadovi sa validnim podacima u HeyReach kampanji." }, { status: 400 });
  }

  const supabase = await createClient();

  const name = audienceName || `HeyReach #${heyreachCampaignId}`;

  // Create audience
  const { data: audience, error: audErr } = await supabase
    .from("audiences")
    .insert({
      client_id: clientId,
      campaign_id: campaignId,
      sender_profile_id: senderProfileId,
      icp_profile_id: icpId,
      name,
      source: "heyreach",
      source_meta: { heyreach_campaign_id: heyreachCampaignId },
      row_count: rawMembers.length,
      imported_by: meId,
    })
    .select("id")
    .single();

  if (audErr) return NextResponse.json({ error: audErr.message }, { status: 500 });

  // Insert audience_members in chunks
  const CHUNK = 500;
  for (let i = 0; i < rawMembers.length; i += CHUNK) {
    const { error: mErr } = await supabase
      .from("audience_members")
      .insert(
        rawMembers.slice(i, i + CHUNK).map((raw) => ({
          audience_id: audience.id,
          raw,
          qualify_status: "pending",
        }))
      );
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
  }

  return NextResponse.json({ audience_id: audience.id, count: rawMembers.length });
}
