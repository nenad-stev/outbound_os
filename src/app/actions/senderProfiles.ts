"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type SenderProfileFormState = { error: string | null };

function parse(formData: FormData) {
  return {
    full_name: String(formData.get("full_name") ?? "").trim(),
    linkedin_url: String(formData.get("linkedin_url") ?? "").trim() || null,
    heyreach_account_id:
      String(formData.get("heyreach_account_id") ?? "").trim() || null,
    daily_limit: Math.max(1, Number(formData.get("daily_limit") ?? 20)),
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function createSenderProfileAction(
  clientId: string,
  _prev: SenderProfileFormState,
  formData: FormData
): Promise<SenderProfileFormState> {
  await requireRole("operator");
  const fields = parse(formData);
  if (!fields.full_name) return { error: "Full name is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("sender_profiles")
    .insert({ ...fields, client_id: clientId });

  if (error) return { error: error.message };

  revalidatePath(`/clients/${clientId}/profiles`);
  redirect(`/clients/${clientId}/profiles`);
}

export async function updateSenderProfileAction(
  id: string,
  clientId: string,
  _prev: SenderProfileFormState,
  formData: FormData
): Promise<SenderProfileFormState> {
  await requireRole("operator");
  const fields = parse(formData);
  if (!fields.full_name) return { error: "Full name is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("sender_profiles")
    .update(fields)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/clients/${clientId}/profiles`);
  revalidatePath(`/clients/${clientId}/profiles/${id}`);
  return { error: null };
}

export async function toggleSenderProfileActive(
  id: string,
  clientId: string,
  isActive: boolean
) {
  await requireRole("operator");
  const supabase = await createClient();
  await supabase
    .from("sender_profiles")
    .update({ is_active: isActive })
    .eq("id", id);
  revalidatePath(`/clients/${clientId}/profiles`);
  revalidatePath(`/clients/${clientId}/profiles/${id}`);
}
