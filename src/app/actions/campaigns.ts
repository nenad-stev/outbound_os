"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole, getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CampaignType, PersonalizationLevel, SequenceChannel } from "@/lib/types";

export type CampaignFormState = { error: string | null };

export interface StepInput {
  step_order: number;
  channel: SequenceChannel;
  template_text: string;
  ai_instructions: string | null;
  delay_days: number;
}

function parseCampaign(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    type: (formData.get("type") ?? "initial") as CampaignType,
    personalization_level: (formData.get("personalization_level") ?? "light") as PersonalizationLevel,
    heyreach_campaign_id: String(formData.get("heyreach_campaign_id") ?? "").trim() || null,
    parent_campaign_id: String(formData.get("parent_campaign_id") ?? "").trim() || null,
    sender_profile_id: String(formData.get("sender_profile_id") ?? "").trim() || null,
    followup_delay_days: Number(formData.get("followup_delay_days") ?? 60) || 60,
  };
}

function parseSteps(formData: FormData): StepInput[] {
  const count = Number(formData.get("step_count") ?? 0);
  const steps: StepInput[] = [];
  for (let i = 0; i < count; i++) {
    const text = String(formData.get(`step_${i}_text`) ?? "").trim();
    if (!text) continue;
    steps.push({
      step_order: i + 1,
      channel: (formData.get(`step_${i}_channel`) ?? "message") as SequenceChannel,
      template_text: text,
      ai_instructions: String(formData.get(`step_${i}_ai_instructions`) ?? "").trim() || null,
      delay_days: Number(formData.get(`step_${i}_delay`) ?? 0),
    });
  }
  return steps;
}

export async function createCampaignAction(
  clientId: string,
  _prev: CampaignFormState,
  formData: FormData
): Promise<CampaignFormState> {
  await requireRole("operator");
  const me = await getCurrentUser();
  const fields = parseCampaign(formData);
  if (!fields.name) return { error: "Name is required." };

  const steps = parseSteps(formData);
  if (steps.length === 0) return { error: "Add at least one sequence step." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .insert({ ...fields, client_id: clientId, created_by: me?.id ?? null })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const { error: stepsError } = await supabase
    .from("sequence_steps")
    .insert(steps.map((s) => ({ ...s, campaign_id: data.id })));

  if (stepsError) return { error: stepsError.message };

  revalidatePath(`/clients/${clientId}/campaigns`);
  redirect(`/clients/${clientId}/campaigns/${data.id}`);
}

export async function updateCampaignAction(
  id: string,
  clientId: string,
  _prev: CampaignFormState,
  formData: FormData
): Promise<CampaignFormState> {
  await requireRole("operator");
  const fields = parseCampaign(formData);
  if (!fields.name) return { error: "Name is required." };

  const steps = parseSteps(formData);
  if (steps.length === 0) return { error: "Add at least one sequence step." };

  const supabase = await createClient();
  const { error } = await supabase.from("campaigns").update(fields).eq("id", id);
  if (error) return { error: error.message };

  // Replace all steps
  await supabase.from("sequence_steps").delete().eq("campaign_id", id);
  const { error: stepsError } = await supabase
    .from("sequence_steps")
    .insert(steps.map((s) => ({ ...s, campaign_id: id })));
  if (stepsError) return { error: stepsError.message };

  revalidatePath(`/clients/${clientId}/campaigns`);
  revalidatePath(`/clients/${clientId}/campaigns/${id}`);
  return { error: null };
}

export async function setCampaignStatus(
  id: string,
  clientId: string,
  status: string
) {
  await requireRole("operator");
  const supabase = await createClient();
  await supabase.from("campaigns").update({ status }).eq("id", id);
  revalidatePath(`/clients/${clientId}/campaigns`);
  revalidatePath(`/clients/${clientId}/campaigns/${id}`);
}
