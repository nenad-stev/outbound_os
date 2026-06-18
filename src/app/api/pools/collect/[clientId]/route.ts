import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ROTATION_DAYS = 30;

function first<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  const supabase = await createClient();

  const [
    { data: assignments },
    { data: profiles },
    { data: existingRot },
    { data: existingFup },
  ] = await Promise.all([
    supabase
      .from("lead_assignments")
      .select(`
        id, person_id, status, rotation_round, assigned_at,
        sender_profile_id,
        campaigns(id, followup_delay_days),
        sender_profiles(id, rotation_order),
        connection_status(state, withdrawn_at, accepted_at)
      `)
      .eq("client_id", clientId)
      .in("status", ["pushed", "active", "replied", "completed"]),
    supabase
      .from("sender_profiles")
      .select("id, rotation_order")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .order("rotation_order"),
    supabase
      .from("rotation_pool")
      .select("source_assignment_id")
      .eq("client_id", clientId)
      .in("status", ["pending", "approved"]),
    supabase
      .from("followup_pool")
      .select("source_assignment_id")
      .eq("client_id", clientId)
      .in("status", ["pending", "approved"]),
  ]);

  const rotSet = new Set((existingRot ?? []).map((r: any) => r.source_assignment_id as string));
  const fupSet = new Set((existingFup ?? []).map((f: any) => f.source_assignment_id as string));
  const profileList = (profiles ?? []) as any[];
  const now = Date.now();

  const rotIns: any[] = [];
  const fupIns: any[] = [];

  for (const a of (assignments ?? []) as any[]) {
    const cs = first<any>(a.connection_status);
    const campaign = first<any>(a.campaigns);
    const sender = first<any>(a.sender_profiles);
    if (!cs) continue;

    // --- Rotation eligibility ---
    // Connection was withdrawn (not accepted) + at least 30 days ago + lead never replied
    if (
      !rotSet.has(a.id) &&
      cs.state === "withdrawn" &&
      cs.withdrawn_at &&
      a.status !== "replied"
    ) {
      const daysSinceWithdrawn = (now - new Date(cs.withdrawn_at).getTime()) / 86_400_000;
      if (daysSinceWithdrawn >= ROTATION_DAYS) {
        const curOrder = sender?.rotation_order ?? 0;
        const nextProfile = profileList.find(
          (p) => p.rotation_order > curOrder && p.id !== a.sender_profile_id
        );
        rotIns.push({
          person_id: a.person_id,
          client_id: clientId,
          from_profile_id: a.sender_profile_id,
          to_profile_id: nextProfile?.id ?? null,
          source_assignment_id: a.id,
          status: "pending",
        });
      }
    }

    // --- Follow-up eligibility ---
    // Connection accepted + no reply + campaign delay has passed
    if (
      !fupSet.has(a.id) &&
      cs.state === "accepted" &&
      a.status !== "replied" &&
      (a.status === "active" || a.status === "completed")
    ) {
      const delayDays = campaign?.followup_delay_days ?? 60;
      const daysSinceAssigned = (now - new Date(a.assigned_at).getTime()) / 86_400_000;
      if (daysSinceAssigned >= delayDays) {
        fupIns.push({
          person_id: a.person_id,
          client_id: clientId,
          source_campaign_id: campaign?.id ?? null,
          source_assignment_id: a.id,
          status: "pending",
        });
      }
    }
  }

  const [rotRes, fupRes] = await Promise.all([
    rotIns.length ? supabase.from("rotation_pool").insert(rotIns) : Promise.resolve({ error: null }),
    fupIns.length ? supabase.from("followup_pool").insert(fupIns) : Promise.resolve({ error: null }),
  ]);

  const errors = [rotRes.error?.message, fupRes.error?.message].filter(Boolean);
  return NextResponse.json({ rotation_added: rotIns.length, followup_added: fupIns.length, errors });
}
