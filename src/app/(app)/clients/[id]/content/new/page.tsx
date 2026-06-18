import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import PostGenerator from "./PostGenerator";

export default async function NewContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: clientData }, { data: profiles }] = await Promise.all([
    supabase.from("clients").select("id, name").eq("id", id).maybeSingle(),
    supabase
      .from("sender_profiles")
      .select("id, full_name")
      .eq("client_id", id)
      .order("full_name"),
  ]);

  if (!clientData) notFound();

  const profileIds = (profiles ?? []).map((p: any) => p.id);
  const { data: strategiesRaw } = profileIds.length > 0
    ? await supabase.from("content_strategies").select("id, sender_profile_id").in("sender_profile_id", profileIds)
    : { data: [] as any[] };

  const strategyIds = (strategiesRaw ?? []).map((s: any) => s.id);
  const { data: pillarsRaw } = strategyIds.length > 0
    ? await supabase
        .from("content_pillars")
        .select("id, strategy_id, name, description")
        .in("strategy_id", strategyIds)
        .order("sort_order")
    : { data: [] as any[] };

  const pillarsById = new Map<string, any[]>();
  for (const p of (pillarsRaw ?? []) as any[]) {
    const arr = pillarsById.get(p.strategy_id) ?? [];
    arr.push(p);
    pillarsById.set(p.strategy_id, arr);
  }

  const strategies = (strategiesRaw ?? []).map((s: any) => ({
    id: s.id,
    sender_profile_id: s.sender_profile_id,
    pillars: pillarsById.get(s.id) ?? [],
  }));

  return (
    <div>
      <Link href={`/clients/${id}/content`} style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", textDecoration: "none", display: "inline-block", marginBottom: "16px" }}>
        ← Content
      </Link>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "8px 0 24px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#FFFFFF" }}>Novi post</h1>
          <p style={{ fontSize: "14px", color: "#BDBDBD", marginTop: "4px" }}>{clientData.name}</p>
        </div>
        <Link
          href={`/clients/${id}/content/strategy`}
          style={{ backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#FFFFFF", borderRadius: "12px", padding: "10px 20px", fontSize: "14px", textDecoration: "none" }}
        >
          Strategija →
        </Link>
      </div>

      {profiles?.length === 0 ? (
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.35)" }}>
          Nema sender profila.{" "}
          <Link href={`/clients/${id}/profiles/new`} style={{ color: "#FFCC00", textDecoration: "none" }}>
            Dodaj profil →
          </Link>
        </p>
      ) : (
        <PostGenerator
          clientId={id}
          profiles={(profiles ?? []) as any[]}
          strategies={strategies}
        />
      )}
    </div>
  );
}
