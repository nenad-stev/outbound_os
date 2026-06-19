"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function setMemberReviewStatus(
  memberId: string,
  status: "approved" | "rejected",
  clientId: string,
  audienceId: string
) {
  await requireRole("operator");
  const supabase = await createClient();
  await supabase
    .from("audience_members")
    .update({ review_status: status })
    .eq("id", memberId);
  revalidatePath(`/clients/${clientId}/review`);
  revalidatePath(`/clients/${clientId}/audiences/${audienceId}/members`);
}

export async function updateMemberPersonalization(
  memberId: string,
  personalization: string,
  clientId: string,
  _audienceId: string
) {
  await requireRole("operator");
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("audience_members")
    .select("raw")
    .eq("id", memberId)
    .maybeSingle();
  if (!member) return;
  const raw = { ...(member.raw as Record<string, unknown>), personalization };
  await supabase.from("audience_members").update({ raw }).eq("id", memberId);
  revalidatePath(`/clients/${clientId}/review`);
}

// Save one sequence step's full rendered message for a lead.
export async function updateMemberMessage(
  memberId: string,
  stepOrder: number,
  text: string,
  clientId: string
) {
  await requireRole("operator");
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("audience_members")
    .select("raw")
    .eq("id", memberId)
    .maybeSingle();
  if (!member) return;
  const raw = (member.raw as Record<string, any>) ?? {};
  const rendered_messages = { ...(raw.rendered_messages ?? {}), [String(stepOrder)]: text };
  await supabase
    .from("audience_members")
    .update({ raw: { ...raw, rendered_messages } })
    .eq("id", memberId);
  revalidatePath(`/clients/${clientId}/review`);
}

export async function bulkSetReviewStatus(
  memberIds: string[],
  status: "approved" | "rejected",
  clientId: string,
  audienceId: string
) {
  await requireRole("operator");
  const supabase = await createClient();
  await supabase
    .from("audience_members")
    .update({ review_status: status })
    .in("id", memberIds);
  revalidatePath(`/clients/${clientId}/review`);
  revalidatePath(`/clients/${clientId}/audiences/${audienceId}/members`);
}
