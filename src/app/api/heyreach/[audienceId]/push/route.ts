import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { nameSequenceSteps } from "@/lib/sequence";

const HEYREACH_BASE = process.env.HEYREACH_BASE_URL ?? "https://api.heyreach.io/api/public";
const HEYREACH_KEY = process.env.HEYREACH_API_KEY ?? "";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ audienceId: string }> }
) {
  const { audienceId } = await params;
  const supabase = await createClient();

  // Load audience + campaign + sender profile
  const { data: audience, error: audErr } = await supabase
    .from("audiences")
    .select("id, client_id, campaign_id, sender_profile_id, campaigns(heyreach_campaign_id, name), sender_profiles(heyreach_account_id)")
    .eq("id", audienceId)
    .maybeSingle();

  if (audErr || !audience) {
    return NextResponse.json({ error: "Audience not found." }, { status: 404 });
  }

  const aud = audience as any;
  const heyreachCampaignId = aud.campaigns?.heyreach_campaign_id;
  const heyreachAccountId = aud.sender_profiles?.heyreach_account_id;

  if (!heyreachCampaignId) {
    return NextResponse.json(
      { error: "Kampanja nema HeyReach campaign ID. Dodaj ga u campaign settings." },
      { status: 400 }
    );
  }
  if (!heyreachAccountId) {
    return NextResponse.json(
      { error: "Sender profile nema HeyReach account ID. Dodaj ga u sender profile settings." },
      { status: 400 }
    );
  }

  // Sequence steps → named HeyReach variables. Steps with a template require a
  // rendered per-lead message before push.
  const { data: stepRows } = await supabase
    .from("sequence_steps")
    .select("step_order, channel, template_text, delay_days")
    .eq("campaign_id", aud.campaign_id);
  const namedSteps = nameSequenceSteps((stepRows ?? []) as any[]);
  const requiredSteps = namedSteps.filter((s) => (s.template_text ?? "").trim());

  // Load approved members not yet pushed
  const { data: members, error: memErr } = await supabase
    .from("audience_members")
    .select("id, raw")
    .eq("audience_id", audienceId)
    .eq("qualify_status", "qualified")
    .eq("review_status", "approved");

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });
  if (!members || members.length === 0) {
    return NextResponse.json({ pushed: 0, message: "Nema approved leadova za push." });
  }

  // Partition: only push leads that have what's needed. Skipped ones stay
  // "approved" so they can be fixed and re-pushed.
  const valid: typeof members = [];
  const skipped: { name: string; reason: string }[] = [];
  for (const m of members) {
    const r = m.raw as any;
    const name = r.full_name || `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || r.linkedin_url || "—";
    if (!r.linkedin_url) { skipped.push({ name, reason: "nema LinkedIn URL" }); continue; }
    const rendered = (r.rendered_messages ?? {}) as Record<string, string>;
    const missingStep = requiredSteps.find((s) => !String(rendered[String(s.step_order)] ?? "").trim());
    if (missingStep) {
      skipped.push({ name, reason: `nema poruku (${missingStep.label})` });
      continue;
    }
    valid.push(m);
  }

  if (valid.length === 0) {
    return NextResponse.json(
      { pushed: 0, skipped, error: "Svi approved leadovi su preskočeni — fali LinkedIn URL ili poruka." },
      { status: 400 }
    );
  }

  // Build HeyReach payload. Each sequence step → a custom variable
  // ({{message_1}}, {{connection_note}}…) carrying the rendered per-lead text.
  // HeyReach expects batches; we send all at once (max 1000 per call).
  const leadsWithLinkedInAccountIds = valid.map((m) => {
    const r = m.raw as any;
    const rendered = (r.rendered_messages ?? {}) as Record<string, string>;
    const customVariables = requiredSteps
      .map((s) => ({ name: s.variableName, value: String(rendered[String(s.step_order)] ?? "") }))
      .filter((v) => v.value.trim());
    // Back-compat: keep legacy {personalization} if present and no rendered messages.
    if (customVariables.length === 0 && r.personalization) {
      customVariables.push({ name: "personalization", value: String(r.personalization) });
    }
    return {
      lead: {
        firstName: r.first_name ?? r.full_name?.split(" ")[0] ?? "",
        lastName: r.last_name ?? r.full_name?.split(" ").slice(1).join(" ") ?? "",
        linkedInUrl: r.linkedin_url ?? "",
        email: r.email ?? "",
        companyName: r.company_name ?? "",
        position: r.title ?? "",
        customVariables,
      },
      linkedInAccountId: heyreachAccountId,
    };
  });

  // Call HeyReach
  let pushResponse: any;
  try {
    const res = await fetch(`${HEYREACH_BASE}/AddLeadsToCampaignV2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": HEYREACH_KEY,
      },
      body: JSON.stringify({
        campaignId: heyreachCampaignId,
        leadsWithLinkedInAccountIds,
      }),
    });
    pushResponse = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: pushResponse?.message ?? `HeyReach error: ${res.status}` },
        { status: 502 }
      );
    }
  } catch (e: any) {
    return NextResponse.json({ error: `HeyReach request failed: ${e.message}` }, { status: 502 });
  }

  // Mark only the pushed (valid) members as pushed
  const memberIds = valid.map((m) => m.id);
  await supabase
    .from("audience_members")
    .update({ review_status: "pushed" })
    .in("id", memberIds);

  // Upsert companies + people + lead_assignments + connection_status (best-effort)
  for (const m of valid) {
    const r = m.raw as any;
    try {
      // Upsert company (dedup on domain when present)
      let companyId: string | null = null;
      const co = r.company_enrichment ?? {};
      if (r.company_domain || r.company_linkedin_url) {
        const { data: company } = await supabase
          .from("companies")
          .upsert(
            {
              name: r.company_name ?? co.name ?? null,
              domain: r.company_domain ?? null,
              linkedin_company_url: r.company_linkedin_url ?? null,
              industry: r.industry ?? co.industry ?? null,
              employee_count: co.employee_count ?? null,
            },
            r.company_domain
              ? { onConflict: "domain", ignoreDuplicates: false }
              : { ignoreDuplicates: false }
          )
          .select("id")
          .maybeSingle();
        companyId = company?.id ?? null;
      }

      // Upsert person
      const { data: person } = await supabase
        .from("people")
        .upsert(
          {
            linkedin_url: r.linkedin_url ?? null,
            email: r.email ?? null,
            first_name: r.first_name ?? null,
            last_name: r.last_name ?? null,
            full_name: r.full_name ?? null,
            title: r.title ?? null,
            company_id: companyId,
          },
          {
            onConflict: r.linkedin_url ? "linkedin_url" : "email",
            ignoreDuplicates: false,
          }
        )
        .select("id")
        .maybeSingle();

      if (!person) continue;

      // Upsert lead_assignment, then read back its id (conflict returns no row)
      await supabase.from("lead_assignments").upsert(
        {
          person_id: person.id,
          company_id: companyId,
          client_id: aud.client_id,
          sender_profile_id: aud.sender_profile_id ?? null,
          campaign_id: aud.campaign_id ?? null,
          audience_id: audienceId,
          status: "pushed",
        },
        { onConflict: "person_id,client_id", ignoreDuplicates: true }
      );

      const { data: assignment } = await supabase
        .from("lead_assignments")
        .select("id")
        .eq("person_id", person.id)
        .eq("client_id", aud.client_id)
        .order("assigned_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (assignment) {
        // Initial LinkedIn flow starts with a connection request
        await supabase.from("connection_status").upsert(
          {
            lead_assignment_id: assignment.id,
            state: "requested",
            requested_at: new Date().toISOString(),
          },
          { onConflict: "lead_assignment_id", ignoreDuplicates: true }
        );
      }
    } catch {
      // Non-critical — continue
    }
  }

  return NextResponse.json({ pushed: memberIds.length, skipped });
}
