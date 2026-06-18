"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Rotation pool
// ---------------------------------------------------------------------------

export async function dismissRotation(poolId: string, clientId: string) {
  await requireRole("operator");
  const supabase = await createClient();
  await supabase.from("rotation_pool").update({ status: "dismissed" }).eq("id", poolId);
  revalidatePath(`/clients/${clientId}/rotation`);
}

// Approve rotation: marks old assignment rotated_out, creates new assignment on next profile.
export async function approveRotation(
  poolId: string,
  sourceAssignmentId: string,
  toProfileId: string | null,
  clientId: string
) {
  await requireRole("operator");
  const supabase = await createClient();

  if (!toProfileId) {
    // No next profile available — just dismiss
    await supabase.from("rotation_pool").update({ status: "dismissed" }).eq("id", poolId);
    revalidatePath(`/clients/${clientId}/rotation`);
    return;
  }

  const { data: src } = await supabase
    .from("lead_assignments")
    .select("person_id, company_id, campaign_id, audience_id, rotation_round")
    .eq("id", sourceAssignmentId)
    .maybeSingle();

  if (!src) return;

  // Mark old as rotated_out first to release the active-per-client unique index
  await supabase
    .from("lead_assignments")
    .update({ status: "rotated_out" })
    .eq("id", sourceAssignmentId);

  // Insert new assignment on next profile (status=approved so operator can push it)
  await supabase.from("lead_assignments").insert({
    person_id: src.person_id,
    company_id: src.company_id,
    client_id: clientId,
    sender_profile_id: toProfileId,
    campaign_id: src.campaign_id,
    audience_id: src.audience_id,
    status: "approved",
    rotation_round: (src.rotation_round ?? 1) + 1,
  });

  // Mark pool entry as approved
  await supabase.from("rotation_pool").update({ status: "approved" }).eq("id", poolId);

  revalidatePath(`/clients/${clientId}/rotation`);
  revalidatePath(`/clients/${clientId}/ledger`);
}

// ---------------------------------------------------------------------------
// Follow-up pool
// ---------------------------------------------------------------------------

export async function dismissFollowup(poolId: string, clientId: string) {
  await requireRole("operator");
  const supabase = await createClient();
  await supabase.from("followup_pool").update({ status: "dismissed" }).eq("id", poolId);
  revalidatePath(`/clients/${clientId}/followups`);
}

export async function approveFollowup(poolId: string, clientId: string) {
  await requireRole("operator");
  const supabase = await createClient();
  // Mark as approved — signals intent; actual campaign enrollment is handled
  // by creating a follow-up audience and pushing from Review Queue.
  await supabase.from("followup_pool").update({ status: "approved" }).eq("id", poolId);
  revalidatePath(`/clients/${clientId}/followups`);
}

// ---------------------------------------------------------------------------
// FormData-based wrappers (for use as form actions with hidden inputs)
// ---------------------------------------------------------------------------

export async function approveRotationForm(fd: FormData) {
  const poolId = fd.get("poolId") as string;
  const sourceAssignmentId = fd.get("sourceAssignmentId") as string;
  const toProfileId = (fd.get("toProfileId") as string) || null;
  const clientId = fd.get("clientId") as string;
  await approveRotation(poolId, sourceAssignmentId, toProfileId, clientId);
}

export async function dismissRotationForm(fd: FormData) {
  const poolId = fd.get("poolId") as string;
  const clientId = fd.get("clientId") as string;
  await dismissRotation(poolId, clientId);
}

export async function approveFollowupForm(fd: FormData) {
  const poolId = fd.get("poolId") as string;
  const clientId = fd.get("clientId") as string;
  await approveFollowup(poolId, clientId);
}

export async function dismissFollowupForm(fd: FormData) {
  const poolId = fd.get("poolId") as string;
  const clientId = fd.get("clientId") as string;
  await dismissFollowup(poolId, clientId);
}
