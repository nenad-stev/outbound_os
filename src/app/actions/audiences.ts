"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole, ensureAppUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseAndNormalize } from "@/lib/csv-normalizer";

export type AudienceFormState = { error: string | null };

export async function uploadAudienceAction(
  clientId: string,
  _prev: AudienceFormState,
  formData: FormData
): Promise<AudienceFormState> {
  await requireRole("operator");
  const meId = await ensureAppUser();

  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  const icpId = String(formData.get("icp_profile_id") ?? "").trim();
  const file = formData.get("csv_file") as File | null;

  if (!campaignId) return { error: "Izaberi kampanju." };
  if (!icpId) return { error: "Izaberi ICP profil." };
  if (!file || file.size === 0) return { error: "Uploaduj CSV fajl." };
  if (!file.name.toLowerCase().endsWith(".csv")) return { error: "Fajl mora biti .csv format." };
  if (file.size > 10 * 1024 * 1024) return { error: "Fajl je preveliki (max 10MB)." };

  const csvText = await file.text();
  const { leads, format, skipped } = parseAndNormalize(csvText);

  if (leads.length === 0)
    return { error: `Nije pronađen nijedan validan lead. Format: ${format}. Preskočeno: ${skipped}.` };

  const supabase = await createClient();

  // Create audience record
  const { data: audience, error: audErr } = await supabase
    .from("audiences")
    .insert({
      client_id: clientId,
      campaign_id: campaignId,
      icp_profile_id: icpId,
      name: file.name.replace(/\.csv$/i, ""),
      source: "csv",
      source_meta: { filename: file.name, format, skipped },
      row_count: leads.length,
      imported_by: meId,
    })
    .select("id")
    .single();

  if (audErr) return { error: audErr.message };

  // Bulk insert audience members with raw data
  const members = leads.map((lead) => ({
    audience_id: audience.id,
    raw: lead,
    qualify_status: "pending",
  }));

  const CHUNK = 500;
  for (let i = 0; i < members.length; i += CHUNK) {
    const { error: mErr } = await supabase
      .from("audience_members")
      .insert(members.slice(i, i + CHUNK));
    if (mErr) return { error: mErr.message };
  }

  revalidatePath(`/clients/${clientId}/audiences`);
  redirect(`/clients/${clientId}/audiences/${audience.id}`);
}
