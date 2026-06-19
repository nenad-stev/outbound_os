import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import ApolloSearchClient from "./ApolloSearchClient";

export default async function ApolloSearchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: clientId } = await params;
  const supabase = await createClient();

  const [{ data: client }, { data: campaignsData }, { data: icpData }, { data: searches }] =
    await Promise.all([
      supabase.from("clients").select("name").eq("id", clientId).maybeSingle(),
      supabase
        .from("campaigns")
        .select("id, name, sender_profiles(full_name)")
        .eq("client_id", clientId)
        .neq("status", "archived")
        .order("created_at", { ascending: false }),
      supabase
        .from("icp_profiles")
        .select("id, name, is_default")
        .eq("client_id", clientId)
        .order("created_at"),
      supabase
        .from("apollo_searches")
        .select("id, name, summary, filters, total_entries, leads_imported, pages_fetched, audience_id, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  if (!client) notFound();

  const campaigns = ((campaignsData ?? []) as any[]).map((c) => ({
    id: c.id,
    name: c.name,
    sender_name: (c.sender_profiles as any)?.full_name ?? null,
  }));
  const icpProfiles = (icpData ?? []) as { id: string; name: string; is_default: boolean }[];

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div>
        <Link
          href={`/clients/${clientId}/audiences`}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          ← Audiences
        </Link>
        <h1 className="text-xl font-semibold text-zinc-100 mt-2">Apollo Search</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Importuj leadove direktno iz Apollo-a u Review Queue za {client.name}.
        </p>
      </div>

      <ApolloSearchClient
        clientId={clientId}
        campaigns={campaigns}
        icpProfiles={icpProfiles}
        initialSearches={searches ?? []}
      />
    </div>
  );
}
