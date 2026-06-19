import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  apolloSearchPeople,
  apolloBulkMatch,
  apolloToNormalized,
  buildParams,
  summarizeSearchAI,
  type ApolloFilters,
} from "@/lib/apollo";

export const maxDuration = 60;

interface RequestBody {
  client_id: string;
  search_id?: string;
  filters?: ApolloFilters;
  name?: string;
  campaign_id?: string;
  icp_profile_id?: string;
  limit?: number;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const { client_id, search_id, limit = 100 } = body;

    if (!client_id) {
      return NextResponse.json({ error: "client_id required" }, { status: 400 });
    }

    // ── Load or create search record ────────────────────────────────────────
    let search: {
      id: string;
      filters: ApolloFilters;
      pages_fetched: number;
      leads_imported: number;
      total_entries: number | null;
      per_page: number;
      audience_id: string | null;
      campaign_id: string | null;
      icp_profile_id: string | null;
      name: string | null;
      summary: string | null;
    };

    if (search_id) {
      const { data, error } = await supabase
        .from("apollo_searches")
        .select("*")
        .eq("id", search_id)
        .eq("client_id", client_id)
        .single();
      if (error || !data) {
        return NextResponse.json({ error: "Search not found" }, { status: 404 });
      }
      search = data;
    } else {
      if (!body.filters) {
        return NextResponse.json({ error: "filters required for new search" }, { status: 400 });
      }
      if (!body.campaign_id) {
        return NextResponse.json({ error: "Izaberi kampanju." }, { status: 400 });
      }
      if (!body.icp_profile_id) {
        return NextResponse.json({ error: "Izaberi ICP profil." }, { status: 400 });
      }
      const summary = await summarizeSearchAI(body.filters);
      const { data, error } = await supabase
        .from("apollo_searches")
        .insert({
          client_id,
          name: body.name ?? null,
          filters: body.filters,
          campaign_id: body.campaign_id,
          icp_profile_id: body.icp_profile_id,
          summary,
          per_page: 100,
        })
        .select()
        .single();
      if (error || !data) {
        return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
      }
      search = data;
    }

    // ── Ensure an audience exists for this search ───────────────────────────
    let audienceId = search.audience_id;
    if (!audienceId) {
      const { data: aud, error: audErr } = await supabase
        .from("audiences")
        .insert({
          client_id,
          campaign_id: search.campaign_id,
          icp_profile_id: search.icp_profile_id,
          name: search.name ?? "Apollo search",
          source: "apollo",
          source_meta: { filters: search.filters },
          row_count: 0,
        })
        .select("id")
        .single();
      if (audErr || !aud) {
        return NextResponse.json({ error: audErr?.message ?? "Audience insert failed" }, { status: 500 });
      }
      audienceId = aud.id;
      await supabase.from("apollo_searches").update({ audience_id: audienceId }).eq("id", search.id);
    }

    const perPage = search.per_page;
    const filters = search.filters as ApolloFilters;

    let imported = 0;
    let pagesFetched = search.pages_fetched;
    let totalEntries = search.total_entries ?? null;
    const errors: string[] = [];

    while (imported < limit) {
      const nextPage = pagesFetched + 1;
      let result;
      try {
        result = await apolloSearchPeople(filters, nextPage, perPage);
      } catch (e: any) {
        errors.push(e.message);
        break;
      }

      if (totalEntries === null) {
        totalEntries = result.total_entries ?? null;
      }

      const previews = result.people ?? [];
      if (previews.length === 0) break;

      pagesFetched++;

      const take = Math.min(previews.length, limit - imported);
      const batch = previews.slice(0, take);

      // Reveal full data (linkedin_url) — 1 credit per person
      let fullPeople: any[] = [];
      try {
        fullPeople = await apolloBulkMatch(batch.map((p: any) => p.id));
      } catch (e: any) {
        errors.push(`bulk_match: ${e.message}`);
        if (previews.length < perPage) break;
        continue;
      }

      // Build audience_member rows, skipping LinkedIn URLs already in this audience
      const normalized = fullPeople
        .map((p: any) => apolloToNormalized(p))
        .filter((n) => n.linkedin_url);

      const urls = normalized.map((n) => n.linkedin_url as string);
      let existingUrls = new Set<string>();
      if (urls.length) {
        const { data: existing } = await supabase
          .from("audience_members")
          .select("linkedin_url:raw->>linkedin_url")
          .eq("audience_id", audienceId);
        existingUrls = new Set(
          (existing ?? [])
            .map((r: any) => (r.linkedin_url ?? "").toLowerCase())
            .filter(Boolean)
        );
      }

      const rows = normalized
        .filter((n) => !existingUrls.has((n.linkedin_url as string).toLowerCase()))
        .map((n) => ({ audience_id: audienceId, raw: n, qualify_status: "pending" }));

      if (rows.length) {
        const { error: insErr } = await supabase.from("audience_members").insert(rows);
        if (insErr) {
          errors.push(`members insert: ${insErr.message}`);
        } else {
          imported += rows.length;
        }
      }

      if (previews.length < perPage) break;
    }

    // ── Persist state ─────────────────────────────────────────────────────
    const newTotal = search.leads_imported + imported;
    await supabase
      .from("apollo_searches")
      .update({
        pages_fetched: pagesFetched,
        leads_imported: newTotal,
        total_entries: totalEntries,
        updated_at: new Date().toISOString(),
      })
      .eq("id", search.id);

    // Keep audience row_count in sync
    await supabase.from("audiences").update({ row_count: newTotal }).eq("id", audienceId);

    const remaining =
      totalEntries !== null ? Math.max(0, totalEntries - newTotal) : null;

    return NextResponse.json({
      search_id: search.id,
      audience_id: audienceId,
      imported,
      total_entries: totalEntries,
      leads_imported_total: newTotal,
      pages_fetched: pagesFetched,
      remaining,
      summary: search.summary ?? null,
      filters,
      query_sent: buildParams(filters, 1, perPage),
      ...(errors.length ? { errors: errors.slice(0, 10) } : {}),
    });
  } catch (e: any) {
    console.error("[apollo/search]", e);
    return NextResponse.json({ error: e?.message ?? "Internal server error" }, { status: 500 });
  }
}
