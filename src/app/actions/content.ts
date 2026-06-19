"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { fireLinkedInSchedule } from "@/lib/n8n";

// ---------------------------------------------------------------------------
// Strategy
// ---------------------------------------------------------------------------

export async function upsertStrategy(fd: FormData) {
  await requireRole("operator");
  const supabase = await createClient();
  const sender_profile_id = fd.get("sender_profile_id") as string;
  const client_id = fd.get("client_id") as string;

  const payload = {
    sender_profile_id,
    client_id,
    about_me: (fd.get("about_me") as string) || null,
    tone_voice: (fd.get("tone_voice") as string) || null,
    target_audience: (fd.get("target_audience") as string) || null,
    posting_frequency: (fd.get("posting_frequency") as string) || null,
    extra_rules: (fd.get("extra_rules") as string) || null,
  };

  const { data: existing } = await supabase
    .from("content_strategies")
    .select("id")
    .eq("sender_profile_id", sender_profile_id)
    .maybeSingle();

  if (existing) {
    await supabase.from("content_strategies").update(payload).eq("id", existing.id);
  } else {
    await supabase.from("content_strategies").insert(payload);
  }

  revalidatePath(`/clients/${client_id}/content/strategy`);
}

// ---------------------------------------------------------------------------
// Pillars
// ---------------------------------------------------------------------------

export async function addPillar(fd: FormData) {
  await requireRole("operator");
  const supabase = await createClient();
  const strategy_id = fd.get("strategy_id") as string;
  const client_id = fd.get("client_id") as string;
  const topicsRaw = (fd.get("example_topics") as string) || "";
  const example_topics = topicsRaw
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);

  await supabase.from("content_pillars").insert({
    strategy_id,
    name: fd.get("name") as string,
    description: (fd.get("description") as string) || null,
    example_topics,
  });

  revalidatePath(`/clients/${client_id}/content/strategy`);
}

export async function deletePillar(fd: FormData) {
  await requireRole("operator");
  const supabase = await createClient();
  const id = fd.get("pillar_id") as string;
  const client_id = fd.get("client_id") as string;
  await supabase.from("content_pillars").delete().eq("id", id);
  revalidatePath(`/clients/${client_id}/content/strategy`);
}

// ---------------------------------------------------------------------------
// Post status
// ---------------------------------------------------------------------------

export async function approvePost(fd: FormData) {
  await requireRole("operator");
  const supabase = await createClient();
  const id = fd.get("post_id") as string;
  const client_id = fd.get("client_id") as string;
  await supabase.from("content_posts").update({ status: "approved" }).eq("id", id);
  revalidatePath(`/clients/${client_id}/content`);
}

export async function archivePost(fd: FormData) {
  await requireRole("operator");
  const supabase = await createClient();
  const id = fd.get("post_id") as string;
  const client_id = fd.get("client_id") as string;
  await supabase.from("content_posts").update({ status: "archived" }).eq("id", id);
  revalidatePath(`/clients/${client_id}/content`);
}

export async function markPublished(fd: FormData) {
  await requireRole("operator");
  const supabase = await createClient();
  const id = fd.get("post_id") as string;
  const client_id = fd.get("client_id") as string;
  await supabase
    .from("content_posts")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath(`/clients/${client_id}/content`);
}

// ---------------------------------------------------------------------------
// Scheduling — save content, mark scheduled, hand off to n8n for publishing
// ---------------------------------------------------------------------------

export async function schedulePost(
  fd: FormData
): Promise<{ ok: boolean; error?: string }> {
  await requireRole("operator");
  const supabase = await createClient();
  const id = fd.get("post_id") as string;
  const client_id = fd.get("client_id") as string;
  const content = (fd.get("content") as string) ?? "";
  const scheduledRaw = fd.get("scheduled_at") as string;

  if (!scheduledRaw) return { ok: false, error: "Izaberi datum i vreme." };
  const scheduledAt = new Date(scheduledRaw);
  if (isNaN(scheduledAt.getTime())) return { ok: false, error: "Neispravan datum." };
  if (scheduledAt.getTime() < Date.now() - 60_000)
    return { ok: false, error: "Termin je u prošlosti." };
  if (!content.trim()) return { ok: false, error: "Post je prazan." };

  // Load the identity (sender profile) this post belongs to.
  const { data: post } = await supabase
    .from("content_posts")
    .select("id, sender_profiles(id, full_name, linkedin_url)")
    .eq("id", id)
    .eq("client_id", client_id)
    .maybeSingle();

  if (!post) return { ok: false, error: "Post nije pronađen." };
  const profile = Array.isArray((post as any).sender_profiles)
    ? (post as any).sender_profiles[0]
    : (post as any).sender_profiles;
  if (!profile) return { ok: false, error: "Post nema povezan identity (sender profile)." };

  const scheduledIso = scheduledAt.toISOString();

  const { error: updErr } = await supabase
    .from("content_posts")
    .update({ content, status: "scheduled", scheduled_at: scheduledIso })
    .eq("id", id);
  if (updErr) return { ok: false, error: updErr.message };

  const fired = await fireLinkedInSchedule({
    post_id: id,
    sender_profile_id: profile.id,
    full_name: profile.full_name,
    linkedin_url: profile.linkedin_url ?? null,
    content,
    scheduled_at: scheduledIso,
  });

  // Webhook failed → roll back so the operator isn't left thinking it's queued.
  if (!fired.ok) {
    await supabase
      .from("content_posts")
      .update({ status: "approved", scheduled_at: null })
      .eq("id", id);
    return { ok: false, error: `Zakazivanje nije poslato u n8n: ${fired.error}` };
  }

  revalidatePath(`/clients/${client_id}/content`);
  revalidatePath(`/clients/${client_id}/content/${id}`);
  return { ok: true };
}

export async function cancelSchedule(fd: FormData) {
  await requireRole("operator");
  const supabase = await createClient();
  const id = fd.get("post_id") as string;
  const client_id = fd.get("client_id") as string;
  await supabase
    .from("content_posts")
    .update({ status: "approved", scheduled_at: null })
    .eq("id", id);
  revalidatePath(`/clients/${client_id}/content`);
  revalidatePath(`/clients/${client_id}/content/${id}`);
}

export async function updatePostContent(fd: FormData) {
  await requireRole("operator");
  const supabase = await createClient();
  const id = fd.get("post_id") as string;
  const client_id = fd.get("client_id") as string;
  const content = fd.get("content") as string;
  await supabase.from("content_posts").update({ content }).eq("id", id);
  revalidatePath(`/clients/${client_id}/content`);
}
