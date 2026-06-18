"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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

export async function updatePostContent(fd: FormData) {
  await requireRole("operator");
  const supabase = await createClient();
  const id = fd.get("post_id") as string;
  const client_id = fd.get("client_id") as string;
  const content = fd.get("content") as string;
  await supabase.from("content_posts").update({ content }).eq("id", id);
  revalidatePath(`/clients/${client_id}/content`);
}
