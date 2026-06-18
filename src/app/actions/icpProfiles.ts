"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type IcpFormState = { error: string | null };

function parseArray(raw: string): string[] {
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseRules(raw: string): { field: string; value: string }[] {
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const idx = s.indexOf(":");
      if (idx === -1) return { field: s, value: "" };
      return { field: s.slice(0, idx).trim(), value: s.slice(idx + 1).trim() };
    });
}

function parse(formData: FormData) {
  const icp_fit = Math.max(0, Math.min(100, Number(formData.get("w_icp_fit") ?? 40)));
  const signal = Math.max(0, Math.min(100, Number(formData.get("w_signal") ?? 35)));
  const engagement = Math.max(0, Math.min(100, Number(formData.get("w_engagement") ?? 25)));

  return {
    name: String(formData.get("name") ?? "").trim(),
    target_description: String(formData.get("target_description") ?? "").trim() || null,
    anti_target: String(formData.get("anti_target") ?? "").trim() || null,
    target_roles: parseArray(String(formData.get("target_roles") ?? "")),
    good_signals: parseArray(String(formData.get("good_signals") ?? "")),
    bad_signals: parseArray(String(formData.get("bad_signals") ?? "")),
    weight_overrides: { icp_fit, signal, engagement },
    must_have: parseRules(String(formData.get("must_have") ?? "")),
    must_not: parseRules(String(formData.get("must_not") ?? "")),
  };
}

export async function createIcpProfileAction(
  clientId: string,
  _prev: IcpFormState,
  formData: FormData
): Promise<IcpFormState> {
  await requireRole("operator");
  const fields = parse(formData);
  if (!fields.name) return { error: "Name is required." };

  const total = fields.weight_overrides.icp_fit + fields.weight_overrides.signal + fields.weight_overrides.engagement;
  if (total !== 100) return { error: `Weights must sum to 100 (currently ${total}).` };

  const supabase = await createClient();
  const { error } = await supabase
    .from("icp_profiles")
    .insert({ ...fields, client_id: clientId });

  if (error) return { error: error.message };

  revalidatePath(`/clients/${clientId}/icp`);
  redirect(`/clients/${clientId}/icp`);
}

export async function updateIcpProfileAction(
  id: string,
  clientId: string,
  _prev: IcpFormState,
  formData: FormData
): Promise<IcpFormState> {
  await requireRole("operator");
  const fields = parse(formData);
  if (!fields.name) return { error: "Name is required." };

  const total = fields.weight_overrides.icp_fit + fields.weight_overrides.signal + fields.weight_overrides.engagement;
  if (total !== 100) return { error: `Weights must sum to 100 (currently ${total}).` };

  const supabase = await createClient();
  const { error } = await supabase
    .from("icp_profiles")
    .update(fields)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/clients/${clientId}/icp`);
  revalidatePath(`/clients/${clientId}/icp/${id}`);
  return { error: null };
}

export async function setIcpDefault(id: string, clientId: string) {
  await requireRole("operator");
  const supabase = await createClient();
  await supabase.from("icp_profiles").update({ is_default: false }).eq("client_id", clientId);
  await supabase.from("icp_profiles").update({ is_default: true }).eq("id", id);
  revalidatePath(`/clients/${clientId}/icp`);
}
