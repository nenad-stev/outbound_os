"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function linkSenderProfile(fd: FormData) {
  await requireUser();
  const supabase = await createClient();
  const profileId      = fd.get("profile_id")       as string;
  const hrAccountId    = fd.get("hr_account_id")    as string;

  const { error } = await supabase
    .from("sender_profiles")
    .update({ heyreach_account_id: hrAccountId || null })
    .eq("id", profileId);

  if (error) throw new Error(error.message);
  revalidatePath("/settings/heyreach");
}

export async function linkCampaign(fd: FormData) {
  await requireUser();
  const supabase = await createClient();
  const campaignId   = fd.get("campaign_id")    as string;
  const hrCampaignId = fd.get("hr_campaign_id") as string;

  const { error } = await supabase
    .from("campaigns")
    .update({ heyreach_campaign_id: hrCampaignId || null })
    .eq("id", campaignId);

  if (error) throw new Error(error.message);
  revalidatePath("/settings/heyreach");
}

export async function importSenderFromHeyReach(fd: FormData) {
  await requireUser();
  const supabase = await createClient();

  const clientId     = fd.get("client_id")      as string;
  const hrAccountId  = fd.get("hr_account_id")  as string;
  const fullName     = fd.get("full_name")       as string;
  const linkedinUrl  = fd.get("linkedin_url")    as string | null;

  const { error } = await supabase.from("sender_profiles").insert({
    client_id:           clientId,
    full_name:           fullName,
    linkedin_url:        linkedinUrl || null,
    heyreach_account_id: hrAccountId,
    is_active:           true,
    daily_limit:         20,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/settings/heyreach");
}

export async function createCampaignFromHeyReach(fd: FormData) {
  await requireUser();
  const supabase = await createClient();
  const clientId     = fd.get("client_id")      as string;
  const hrCampaignId = fd.get("hr_campaign_id") as string;
  const name         = fd.get("name")           as string;

  const { error } = await supabase.from("campaigns").insert({
    client_id:           clientId,
    name,
    heyreach_campaign_id: hrCampaignId,
    status:              "active",
    type:                "initial",
  });

  if (error) throw new Error(error.message);
  revalidatePath("/settings/heyreach");
}
