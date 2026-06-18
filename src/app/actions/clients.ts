"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type ClientFormState = { error: string | null };

function parseClient(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const image_style_guide = String(formData.get("image_style_guide") ?? "").trim() || null;
  return { name, website, notes, image_style_guide };
}

export async function createClientAction(
  _prev: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  await requireRole("operator");
  const me = await getCurrentUser();
  const { name, website, notes, image_style_guide } = parseClient(formData);
  if (!name) return { error: "Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({ name, website, notes, image_style_guide, created_by: me?.id ?? null })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/clients");
  redirect(`/clients/${data.id}`);
}

export async function updateClientAction(
  id: string,
  _prev: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  await requireRole("operator");
  const { name, website, notes, image_style_guide } = parseClient(formData);
  if (!name) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ name, website, notes, image_style_guide })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { error: null };
}

export async function setClientActive(id: string, isActive: boolean) {
  await requireRole("operator");
  const supabase = await createClient();
  await supabase.from("clients").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
}
