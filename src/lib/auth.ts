import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppUser, UserRole } from "@/lib/types";
import { redirect } from "next/navigation";

// Ensure the signed-in user has an app_users row (the FK target for
// created_by / imported_by). getCurrentUser() returns a synthetic identity when
// no row exists, so writing that id into a FK column would violate the
// constraint. Returns the app_users id, or null if not signed in / provisioning
// failed (callers then store null instead of breaking the insert).
export async function ensureAppUser(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: existing } = await admin.from("app_users").select("id").eq("id", user.id).maybeSingle();
  if (existing) return existing.id;

  const { error } = await admin.from("app_users").insert({
    id: user.id,
    email: user.email ?? "",
    role: "operator",
  });
  return error ? null : user.id;
}

// Resolves the signed-in user and their app_users role row.
// Falls back to a default 'operator' identity if no app_users row exists yet
// (rows are provisioned by an admin / Supabase dashboard during onboarding).
export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: appUser } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (appUser) return appUser as AppUser;

  return {
    id: user.id,
    email: user.email ?? "",
    full_name: null,
    role: "operator",
    created_at: user.created_at ?? new Date().toISOString(),
  };
}

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

const RANK: Record<UserRole, number> = { viewer: 0, operator: 1, admin: 2 };

export async function requireRole(min: UserRole): Promise<AppUser> {
  const user = await requireUser();
  if (RANK[user.role] < RANK[min]) redirect("/");
  return user;
}
