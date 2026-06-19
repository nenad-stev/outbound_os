import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { generateMessage, type MessageGenLead } from "@/lib/message-gen";

export const maxDuration = 60;

// Regenerate the per-lead `personalization` message for qualified leads in an
// audience from an operator-supplied template/brief. Runs with limited
// concurrency to fit the request window; large batches may need a re-run.
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
    template?: string;
    scope?: "all" | "pending" | "approved";
  };
  const template = (body.template ?? "").trim();
  if (!template) return NextResponse.json({ error: "Template je prazan." }, { status: 400 });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY nije podešen." }, { status: 500 });

  const supabase = await createClient();

  // Persist the template on the audience so it's remembered next time.
  const { data: aud } = await supabase
    .from("audiences")
    .select("source_meta")
    .eq("id", audienceId)
    .maybeSingle();
  const source_meta = { ...((aud?.source_meta as Record<string, unknown>) ?? {}), message_template: template };
  await supabase.from("audiences").update({ source_meta }).eq("id", audienceId);

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
  const CONCURRENCY = 6;

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
        const res = await generateMessage(template, lead, anthropicKey);
        if (!res.ok) { failed++; return; }
        const raw = { ...r, personalization: res.text };
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
