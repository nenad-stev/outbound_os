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

const DEFAULT_BATCH = 3; // small batch keeps each request well under the limit

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ audienceId: string }> }
) {
  const { audienceId } = await params;
  const supabase = await createClient();

  // How many leads to process this request (client drives the loop).
  let batchLimit = DEFAULT_BATCH;
  try {
    const body = await req.json();
    if (body && Number.isFinite(Number(body.limit))) {
      batchLimit = Math.max(1, Math.min(10, Number(body.limit)));
    }
  } catch { /* no body — use default */ }

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

  // Helper: count rows still pending for this audience (drives the client loop).
  async function countPending(): Promise<number> {
    const { count } = await supabase
      .from("audience_members")
      .select("id", { count: "exact", head: true })
      .eq("audience_id", audienceId)
      .eq("qualify_status", "pending");
    return count ?? 0;
  }

  // Atomically claim a small BATCH of pending members (see migrations 0011/0012).
  // FOR UPDATE SKIP LOCKED means concurrent callers never grab the same row, so
  // a lead is never enriched/scored twice. The client calls this repeatedly.
  const { data: members, error: memErr } = await supabase
    .rpc("claim_pending_members", { p_audience_id: audienceId, p_limit: batchLimit });

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });
  if (!members || members.length === 0) {
    // Nothing claimable right now — report cumulative counts + remaining pending
    // so the UI shows real totals (and the loop knows whether to keep going).
    const { data: all } = await supabase
      .from("audience_members")
      .select("qualify_status")
      .eq("audience_id", audienceId);
    const rows = all ?? [];
    return NextResponse.json({
      batch: 0,
      remaining: rows.filter((r) => r.qualify_status === "pending").length,
      qualified: rows.filter((r) => r.qualify_status === "qualified").length,
      disqualified: rows.filter((r) => r.qualify_status === "disqualified").length,
      noData: rows.filter((r) => r.qualify_status === "not_able_to_qualify").length,
    });
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

  const remaining = await countPending();

  // Discord notification only when the whole audience is done (not per batch),
  // with the audience's true cumulative totals.
  if (remaining === 0) {
    const discordUrl = process.env.DISCORD_WEBHOOK_URL;
    if (discordUrl) {
      const { data: all } = await supabase
        .from("audience_members")
        .select("qualify_status")
        .eq("audience_id", audienceId);
      const rows = all ?? [];
      const totQ = rows.filter((r) => r.qualify_status === "qualified").length;
      const totD = rows.filter((r) => r.qualify_status === "disqualified").length;
      const totN = rows.filter((r) => r.qualify_status === "not_able_to_qualify").length;
      await fetch(discordUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `✅ **Pipeline završen** — Audience: ${audience.name}\nQualified: **${totQ}** · Disqualified: ${totD} · No data: ${totN}`,
        }),
      }).catch(() => {});
    }
  }

  // Per-batch counts + remaining pending so the client loop can continue.
  return NextResponse.json({ batch: members.length, qualified, disqualified, noData, remaining });
}
