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
