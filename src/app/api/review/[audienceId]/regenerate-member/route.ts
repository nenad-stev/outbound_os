import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { renderLeadMessages, type MessageGenLead } from "@/lib/message-gen";
import { nameSequenceSteps } from "@/lib/sequence";

export const maxDuration = 60;

// Regenerate messages for a SINGLE lead — used by the per-lead "Generiši" button
// in the Review Queue so stragglers that failed during a concurrent batch (rate
// limit / timeout) can be retried individually without re-running everything.
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
  const body = (await req.json().catch(() => ({}))) as { memberId?: string; brief?: string };
  const memberId = (body.memberId ?? "").trim();
  if (!memberId) return NextResponse.json({ error: "memberId je obavezan." }, { status: 400 });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY nije podešen." }, { status: 500 });

  const supabase = await createClient();

  const { data: aud } = await supabase
    .from("audiences")
    .select("campaign_id, source_meta")
    .eq("id", audienceId)
    .maybeSingle();
  if (!aud?.campaign_id) return NextResponse.json({ error: "Audience nema kampanju." }, { status: 400 });

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

  const { data: member } = await supabase
    .from("audience_members")
    .select("id, raw")
    .eq("id", memberId)
    .eq("audience_id", audienceId)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Lead nije pronađen." }, { status: 404 });

  const r = (member.raw ?? {}) as Record<string, any>;
  const brief = (body.brief ?? (aud.source_meta as any)?.message_brief ?? "").trim() || undefined;

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
  if (!res.ok) return NextResponse.json({ error: res.error ?? "Generisanje nije uspelo." }, { status: 502 });

  // Merge so any manually-edited steps that already exist aren't clobbered by empties.
  const rendered_messages = { ...(r.rendered_messages ?? {}), ...res.messages };
  const { error: updErr } = await supabase
    .from("audience_members")
    .update({ raw: { ...r, rendered_messages } })
    .eq("id", member.id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, messages: rendered_messages });
}
