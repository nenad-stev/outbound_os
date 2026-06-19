"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole, getCurrentUser } from "@/lib/auth";
import { parseAndNormalize } from "@/lib/csv-normalizer";
import type { PersonalizationLevel, SequenceChannel } from "@/lib/types";

// Linear "launch" flow helpers. Unlike the standalone create actions these
// return ids instead of redirecting, so the wizard can chain steps.

export interface LaunchStepInput {
  channel: SequenceChannel;
  template_text: string;
  delay_days: number;
}

export async function createLaunchCampaign(
  clientId: string,
  input: {
    name: string;
    personalization_level: PersonalizationLevel;
    heyreach_campaign_id: string | null;
    sender_profile_id: string | null;
    steps: LaunchStepInput[];
  }
): Promise<{ id?: string; error?: string }> {
  await requireRole("operator");
  const me = await getCurrentUser();

  const name = input.name.trim();
  if (!name) return { error: "Naziv kampanje je obavezan." };
  const steps = input.steps.filter((s) => s.template_text.trim());
  if (steps.length === 0) return { error: "Dodaj bar jednu poruku u sekvencu." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      client_id: clientId,
      name,
      type: "initial",
      personalization_level: input.personalization_level,
      heyreach_campaign_id: input.heyreach_campaign_id || null,
      sender_profile_id: input.sender_profile_id || null,
      created_by: me?.id ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const { error: stepsError } = await supabase.from("sequence_steps").insert(
    steps.map((s, i) => ({
      campaign_id: data.id,
      step_order: i + 1,
      channel: s.channel,
      template_text: s.template_text.trim(),
      delay_days: Number(s.delay_days) || 0,
    }))
  );
  if (stepsError) return { error: stepsError.message };

  return { id: data.id };
}

// Create an audience from an uploaded CSV, wired to campaign + sender + ICP.
export async function createLaunchAudience(
  clientId: string,
  formData: FormData
): Promise<{ id?: string; count?: number; error?: string }> {
  await requireRole("operator");
  const me = await getCurrentUser();

  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  const senderProfileId = String(formData.get("sender_profile_id") ?? "").trim();
  const icpId = String(formData.get("icp_profile_id") ?? "").trim();
  const file = formData.get("csv_file") as File | null;

  if (!campaignId) return { error: "Nedostaje kampanja." };
  if (!icpId) return { error: "Izaberi ICP profil." };
  if (!file || file.size === 0) return { error: "Uploaduj CSV fajl." };
  if (!file.name.toLowerCase().endsWith(".csv")) return { error: "Fajl mora biti .csv." };
  if (file.size > 10 * 1024 * 1024) return { error: "Fajl je preveliki (max 10MB)." };

  const csvText = await file.text();
  const { leads, format, skipped } = parseAndNormalize(csvText);
  if (leads.length === 0) {
    return { error: `Nije pronađen nijedan validan lead. Format: ${format}. Preskočeno: ${skipped}.` };
  }

  const supabase = await createClient();
  const { data: audience, error: audErr } = await supabase
    .from("audiences")
    .insert({
      client_id: clientId,
      campaign_id: campaignId,
      sender_profile_id: senderProfileId || null,
      icp_profile_id: icpId,
      name: file.name.replace(/\.csv$/i, ""),
      source: "csv",
      source_meta: { filename: file.name, format, skipped },
      row_count: leads.length,
      imported_by: me?.id ?? null,
    })
    .select("id")
    .single();
  if (audErr) return { error: audErr.message };

  const members = leads.map((lead) => ({ audience_id: audience.id, raw: lead, qualify_status: "pending" }));
  const CHUNK = 500;
  for (let i = 0; i < members.length; i += CHUNK) {
    const { error: mErr } = await supabase.from("audience_members").insert(members.slice(i, i + CHUNK));
    if (mErr) return { error: mErr.message };
  }

  return { id: audience.id, count: leads.length };
}

// Attach an already-imported audience to campaign + sender + ICP (existing-audience path).
export async function attachLaunchAudience(
  audienceId: string,
  campaignId: string,
  senderProfileId: string | null,
  icpId: string
): Promise<{ id?: string; error?: string }> {
  await requireRole("operator");
  const supabase = await createClient();
  const { error } = await supabase
    .from("audiences")
    .update({ campaign_id: campaignId, sender_profile_id: senderProfileId || null, icp_profile_id: icpId })
    .eq("id", audienceId);
  if (error) return { error: error.message };
  return { id: audienceId };
}
