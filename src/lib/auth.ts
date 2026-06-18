import { createClient } from "@/lib/supabase/server";
import type { AppUser, UserRole } from "@/lib/types";
import { redirect } from "next/navigation";

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
