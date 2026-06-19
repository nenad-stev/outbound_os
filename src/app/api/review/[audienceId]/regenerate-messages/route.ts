import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { renderLeadMessages, type MessageGenLead } from "@/lib/message-gen";
import { nameSequenceSteps } from "@/lib/sequence";

export const maxDuration = 60;

// Regenerate full per-lead messages for every sequence step of an audience's
// campaign, from the operator's step templates (with [bracketed] slots filled
// and names in Serbian vocative). Stored in raw.rendered_messages keyed by
// step_order. Runs with limited concurrency; large batches may need a re-run.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ audienceId: string }> }
) {
  try {
    await requireRole("operator");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { audienceId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    brief?: string;
    scope?: "all" | "pending" | "approved";
  };
  const brief = (body.brief ?? "").trim() || undefined;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY nije podešen." }, { status: 500 });

  const supabase = await createClient();

  // Resolve the audience's campaign and its sequence steps (the templates).
  const { data: aud } = await supabase
    .from("audiences")
    .select("campaign_id, source_meta")
    .eq("id", audienceId)
    .maybeSingle();
  if (!aud?.campaign_id) {
    return NextResponse.json({ error: "Audience nema kampanju." }, { status: 400 });
  }

  const { data: stepRows } = await supabase
    .from("sequence_steps")
    .select("step_order, channel, template_text, delay_days")
    .eq("campaign_id", aud.campaign_id)
    .order("step_order");

  const named = nameSequenceSteps((stepRows ?? []) as any[]);
  const renderSteps = named.map((s) => ({ step_order: s.step_order, label: s.label, template_text: s.template_text }));
  if (renderSteps.every((s) => !(s.template_text ?? "").trim())) {
    return NextResponse.json({ error: "Sekvenca nema poruke. Dodaj korake u Campaigns." }, { status: 400 });
  }

  // Persist the brief on the audience so it's remembered next time.
  if (brief !== undefined) {
    const source_meta = { ...((aud.source_meta as Record<string, unknown>) ?? {}), message_brief: brief ?? "" };
    await supabase.from("audiences").update({ source_meta }).eq("id", audienceId);
  }

  let query = supabase
    .from("audience_members")
    .select("id, raw, review_status")
    .eq("audience_id", audienceId)
    .eq("qualify_status", "qualified");

  if (body.scope === "pending") query = query.eq("review_status", "pending");
  else if (body.scope === "approved") query = query.eq("review_status", "approved");

  const { data: members, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!members?.length) return NextResponse.json({ updated: 0, failed: 0 });

  let updated = 0;
  let failed = 0;
  const CONCURRENCY = 3;

  for (let i = 0; i < members.length; i += CONCURRENCY) {
    const batch = members.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (m) => {
        const r = (m.raw ?? {}) as Record<string, any>;
        const lead: MessageGenLead = {
          first_name: r.first_name,
          last_name: r.last_name,
          full_name: r.full_name,
          title: r.title,
          company_name: r.company_name,
          industry: r.industry,
          location: r.location,
          bio_text: r.bio_text,
          linkedin_about: r.linkedin_about ?? r.about,
        };
        const res = await renderLeadMessages(renderSteps, lead, anthropicKey, brief);
        if (!res.ok) { failed++; return; }
        const raw = { ...r, rendered_messages: res.messages };
        const { error: updErr } = await supabase
          .from("audience_members")
          .update({ raw })
          .eq("id", m.id);
        if (updErr) failed++;
        else updated++;
      })
    );
  }

  return NextResponse.json({ updated, failed, total: members.length });
}
