import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { qualifyLead } from "@/lib/qualify";
import { scoreLead } from "@/lib/score";
import { scrapeLinkedInProfiles, scrapeLinkedInCompanies } from "@/lib/brightdata";
import {
  buildIdentity,
  deriveLinkedInEnrichment,
  emptyLifecycle,
  linkedinKey,
} from "@/lib/enrichment";

export const maxDuration = 300; // 5 min max (Vercel hobby = 60s; use pro for longer)

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ audienceId: string }> }
) {
  const { audienceId } = await params;
  const supabase = await createClient();

  // Load audience + ICP + sender profile (for Owner field)
  const { data: audience, error: audErr } = await supabase
    .from("audiences")
    .select("*, icp_profiles(*), sender_profiles(full_name)")
    .eq("id", audienceId)
    .maybeSingle();

  if (audErr || !audience) {
    return NextResponse.json({ error: "Audience not found." }, { status: 404 });
  }

  const icp = audience.icp_profiles as any;
  const owner = (audience as any).sender_profiles?.full_name ?? null;

  // Load pending members
  const { data: members, error: memErr } = await supabase
    .from("audience_members")
    .select("id, raw")
    .eq("audience_id", audienceId)
    .eq("qualify_status", "pending")
    .order("id");

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });
  if (!members || members.length === 0) {
    return NextResponse.json({ message: "No pending members." });
  }

  // Dedup: fetch contacted_history for this client, build match sets
  const clientId = (audience as any).client_id as string;
  const { data: historyRows } = await supabase
    .from("contacted_history")
    .select("linkedin_url, email")
    .eq("client_id", clientId);

  const contactedLinkedins = new Set<string>();
  const contactedEmails = new Set<string>();
  for (const r of (historyRows ?? []) as any[]) {
    if (r.linkedin_url) contactedLinkedins.add(r.linkedin_url.toLowerCase().trim());
    if (r.email) contactedEmails.add(r.email.toLowerCase().trim());
  }

  // Pre-enrichment: BrightData LinkedIn scrape (people + companies), batched
  const personUrls = (members as any[])
    .map((m) => (m.raw as any).linkedin_url as string | undefined)
    .filter(Boolean) as string[];
  const companyUrls = (members as any[])
    .map((m) => (m.raw as any).company_linkedin_url as string | undefined)
    .filter(Boolean) as string[];

  const [bdProfileMap, bdCompanyMap] = await Promise.all([
    scrapeLinkedInProfiles(personUrls),
    scrapeLinkedInCompanies(companyUrls),
  ]);

  // Process sequentially to avoid rate limits
  let qualified = 0;
  let disqualified = 0;
  let noData = 0;

  for (const member of members) {
    const rawBase = member.raw as any;

    // Skip leads already contacted in a previous campaign (any external tool)
    const liLower = (rawBase.linkedin_url as string | null)?.toLowerCase().trim();
    const emailLower = (rawBase.email as string | null)?.toLowerCase().trim();
    if ((liLower && contactedLinkedins.has(liLower)) || (emailLower && contactedEmails.has(emailLower))) {
      disqualified++;
      await supabase
        .from("audience_members")
        .update({ qualify_status: "disqualified", qualify_source: "none", qualify_reason: "Već kontaktirano – pronađeno u istoriji kontakta." })
        .eq("id", member.id);
      continue;
    }

    // Build identity + LinkedIn enrichment from BrightData result
    const identity = buildIdentity(rawBase, owner);
    const liKey = linkedinKey(rawBase.linkedin_url);
    const bdProfile = liKey ? bdProfileMap.get(liKey) ?? null : null;
    const linkedin = deriveLinkedInEnrichment(
      bdProfile,
      bdProfile ? "enriched" : rawBase.linkedin_url ? "no_data" : "pending"
    );

    // Company enrichment from BrightData company dataset
    const companyKey = linkedinKey(rawBase.company_linkedin_url);
    const companyEnrichment = companyKey ? bdCompanyMap.get(companyKey) ?? null : null;

    // Prefer BrightData about for qualification when present
    const bioText = rawBase.bio_text ?? linkedin.about ?? null;
    const raw = {
      ...rawBase,
      bio_text: bioText,
      identity,
      linkedin,
      company_enrichment: companyEnrichment,
      lifecycle: rawBase.lifecycle ?? emptyLifecycle(),
    };

    try {
      // Step 1: Qualify
      const qualResult = await qualifyLead(
        {
          company_domain: raw.company_domain ?? null,
          company_linkedin_url: raw.company_linkedin_url ?? null,
          linkedin_url: raw.linkedin_url ?? null,
          bio_text: raw.bio_text ?? null,
          company_description: companyEnrichment?.about ?? null,
        },
        {
          target_description: icp?.target_description ?? null,
          anti_target: icp?.anti_target ?? null,
        }
      );

      // Per-lead enrichment trail: which API stage produced what
      const provenance = {
        firecrawl_website: rawBase.company_domain
          ? qualResult.source === "website" ? "ok" : "no_content"
          : "skipped",
        brightdata_person: linkedin.enrichment_status, // enriched | no_data | pending
        brightdata_company: companyEnrichment
          ? "enriched"
          : rawBase.company_linkedin_url ? "no_data" : "skipped",
        ai_qualify: qualResult.source === "no_data" ? "skipped" : "ok",
        qualified_via: qualResult.source,
        ai_score: "skipped" as "skipped" | "ok",
      };

      if (qualResult.source === "no_data") {
        noData++;
        await supabase
          .from("audience_members")
          .update({
            qualify_status: "not_able_to_qualify",
            qualify_source: "none",
            qualify_reason: qualResult.reason,
            raw: { ...raw, provenance },
          })
          .eq("id", member.id);
        continue;
      }

      if (!qualResult.qualified) {
        disqualified++;
        await supabase
          .from("audience_members")
          .update({
            qualify_status: "disqualified",
            qualify_source: qualResult.source,
            qualify_reason: qualResult.reason,
            raw: { ...raw, provenance },
          })
          .eq("id", member.id);
        continue;
      }

      // Step 2: Score qualified leads
      qualified++;
      const scoreResult = await scoreLead(
        {
          first_name: raw.first_name ?? "",
          last_name: raw.last_name ?? "",
          title: raw.title ?? null,
          company_name: raw.company_name ?? null,
          industry: raw.industry ?? null,
          employee_count: raw.employee_count ?? null,
          location: raw.location ?? null,
          qualify_content: qualResult.content,
          linkedin_headline: linkedin.headline,
          linkedin_about: linkedin.about,
        },
        {
          target_description: icp?.target_description ?? null,
          target_roles: icp?.target_roles ?? [],
          good_signals: icp?.good_signals ?? [],
          bad_signals: icp?.bad_signals ?? [],
          weight_overrides: icp?.weight_overrides ?? { icp_fit: 40, signal: 35, engagement: 25 },
          must_have: icp?.must_have ?? [],
          must_not: icp?.must_not ?? [],
        }
      );

      await supabase
        .from("audience_members")
        .update({
          qualify_status: "qualified",
          qualify_source: qualResult.source,
          qualify_reason: qualResult.reason,
          raw: {
            ...raw,
            provenance: { ...provenance, ai_score: "ok" },
            fit_score: scoreResult.fit_score,
            priority: scoreResult.priority,
            score_explanation: scoreResult.explanation,
            personalization: scoreResult.personalization,
            ai_fit: {
              decision_maker_signal: scoreResult.decision_maker_signal,
              role_fit_notes: scoreResult.role_fit_notes,
              linkedin_fit_signals: scoreResult.linkedin_fit_signals,
              linkedin_red_flags: scoreResult.linkedin_red_flags,
            },
          },
        })
        .eq("id", member.id);
    } catch (err) {
      // Don't abort whole pipeline on single lead error
      await supabase
        .from("audience_members")
        .update({
          qualify_status: "not_able_to_qualify",
          qualify_source: "none",
          qualify_reason: `Pipeline error: ${String(err)}`,
        })
        .eq("id", member.id);
      noData++;
    }
  }

  // Discord notification when done
  const discordUrl = process.env.DISCORD_WEBHOOK_URL;
  if (discordUrl) {
    await fetch(discordUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `✅ **Pipeline završen** — Audience: ${audience.name}\nQualified: **${qualified}** · Disqualified: ${disqualified} · No data: ${noData}`,
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ qualified, disqualified, noData });
}
