"use client";

import { useState } from "react";
import ApolloSearchForm from "./ApolloSearchForm";
import { filterRows, describeFilters, type ApolloFilters } from "@/lib/apollo";

interface PastSearch {
  id: string;
  name: string | null;
  summary: string | null;
  filters: Record<string, unknown>;
  total_entries: number | null;
  leads_imported: number;
  pages_fetched: number;
  audience_id: string | null;
  created_at: string;
}

interface SearchResult {
  search_id: string;
  audience_id: string;
  imported: number;
  total_entries: number | null;
  leads_imported_total: number;
  pages_fetched: number;
  remaining: number | null;
  summary?: string | null;
  filters?: Record<string, unknown>;
  query_sent?: Record<string, unknown>;
  errors?: string[];
}

interface Campaign { id: string; name: string; sender_name: string | null }
interface IcpProfile { id: string; name: string; is_default: boolean }

interface Props {
  clientId: string;
  campaigns: Campaign[];
  icpProfiles: IcpProfile[];
  initialSearches: PastSearch[];
  // wizard mode: campaign + ICP pre-chosen; report imported audience back up
  fixedCampaignId?: string;
  fixedIcpId?: string;
  onImported?: (audienceId: string, importedTotal: number) => void;
}

export default function ApolloSearchClient({ clientId, campaigns, icpProfiles, initialSearches, fixedCampaignId, fixedIcpId, onImported }: Props) {
  const [searches, setSearches] = useState<PastSearch[]>(initialSearches);
  const [lastResult, setLastResult] = useState<SearchResult | null>(null);
  const [continueId, setContinueId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(initialSearches.length === 0);

  function handleResult(result: SearchResult) {
    setLastResult(result);
    setContinueId(result.search_id);
    if (onImported && result.audience_id) onImported(result.audience_id, result.leads_imported_total);
    // Refresh the search in the list
    setSearches(prev => {
      const existing = prev.find(s => s.id === result.search_id);
      if (existing) {
        return prev.map(s =>
          s.id === result.search_id
            ? { ...s, leads_imported: result.leads_imported_total, total_entries: result.total_entries, pages_fetched: result.pages_fetched }
            : s
        );
      }
      // New search — reload will show it; add a placeholder
      return [
        {
          id: result.search_id,
          name: null,
          summary: result.summary ?? null,
          filters: result.filters ?? {},
          total_entries: result.total_entries,
          leads_imported: result.leads_imported_total,
          pages_fetched: result.pages_fetched,
          audience_id: result.audience_id,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ];
    });
    setShowNewForm(false);
  }

  const activeSearch = continueId ? searches.find(s => s.id === continueId) : null;

  return (
    <div className="space-y-8">
      {/* Result banner */}
      {lastResult && (
        <div className="rounded-xl bg-emerald-900/30 border border-emerald-700 px-4 py-3 space-y-2">
          <p className="text-sm font-medium text-emerald-300">
            ✓ Importovano {lastResult.imported} novih leadova u audience
          </p>
          {lastResult.summary && (
            <p className="text-xs text-emerald-200/80 flex items-start gap-1">
              <span>✦</span><span>{lastResult.summary}</span>
            </p>
          )}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-emerald-500">
            <span>
              Apollo match (total_entries):{" "}
              <span className="font-semibold text-emerald-300">
                {lastResult.total_entries?.toLocaleString() ?? "?"}
              </span>
            </span>
            <span>
              Importovano ukupno: {lastResult.leads_imported_total.toLocaleString()}
              {lastResult.remaining !== null && lastResult.remaining > 0
                ? ` · još ${lastResult.remaining.toLocaleString()} na čekanju`
                : ""}
            </span>
          </div>
          {lastResult.total_entries !== null && lastResult.total_entries < 50 && (
            <p className="text-xs text-amber-400">
              ⚠ Malo rezultata ({lastResult.total_entries}). Filteri su preuski — skloni industriju/keyword ili duplu lokaciju.
            </p>
          )}
          {lastResult.query_sent && (
            <details className="text-xs">
              <summary className="cursor-pointer text-emerald-400 hover:text-emerald-300 select-none">
                Prikaži JSON poslat Apollo-u (query_sent)
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-950/60 border border-zinc-800 p-3 text-zinc-300">
{JSON.stringify(lastResult.query_sent, null, 2)}
              </pre>
            </details>
          )}
          {lastResult.errors?.length ? (
            <p className="text-xs text-red-400">
              Greške ({lastResult.errors.length}): {lastResult.errors.slice(0, 3).join("; ")}
            </p>
          ) : null}
          <a
            href={`/clients/${clientId}/audiences/${lastResult.audience_id}`}
            className="inline-block text-xs font-medium text-emerald-300 underline hover:text-emerald-200"
          >
            Idi na audience → pokreni pipeline da kvalifikuješ leadove
          </a>
        </div>
      )}

      {/* Continue active search */}
      {activeSearch && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-zinc-100">
                {activeSearch.name ?? "Poslednji search"}
              </h3>
              {(activeSearch.summary || describeFilters(activeSearch.filters as ApolloFilters)) && (
                <p className="text-xs text-zinc-400 mt-0.5 flex items-start gap-1">
                  <span className="text-indigo-400">✦</span>
                  <span>{activeSearch.summary || describeFilters(activeSearch.filters as ApolloFilters)}</span>
                </p>
              )}
              <p className="text-xs text-zinc-500 mt-1">
                importovano{" "}
                <span className="text-zinc-300 font-medium">
                  {activeSearch.leads_imported.toLocaleString()}/{activeSearch.total_entries?.toLocaleString() ?? "?"}
                </span>
              </p>
            </div>
            <button
              onClick={() => { setContinueId(null); setShowNewForm(true); }}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              novi search →
            </button>
          </div>
          <ApolloSearchForm
            clientId={clientId}
            campaigns={campaigns}
            icpProfiles={icpProfiles}
            existingSearchId={activeSearch.id}
            existingName={activeSearch.name ?? undefined}
            fixedCampaignId={fixedCampaignId}
            fixedIcpId={fixedIcpId}
            onResult={handleResult}
          />
        </div>
      )}

      {/* New search form */}
      {(showNewForm || (!activeSearch && searches.length === 0)) && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5">
          <h3 className="text-sm font-medium text-zinc-100 mb-4">Novi Apollo search</h3>
          <ApolloSearchForm
            clientId={clientId}
            campaigns={campaigns}
            icpProfiles={icpProfiles}
            fixedCampaignId={fixedCampaignId}
            fixedIcpId={fixedIcpId}
            onResult={handleResult}
          />
        </div>
      )}

      {/* Past searches */}
      {searches.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Prethodni searchevi</h3>
            {!showNewForm && !activeSearch && (
              <button
                onClick={() => setShowNewForm(true)}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                + novi search
              </button>
            )}
          </div>
          <div className="space-y-2">
            {searches.map(s => {
              const total = s.total_entries;
              const pct = total ? Math.round((s.leads_imported / total) * 100) : 0;
              const remaining = total ? Math.max(0, total - s.leads_imported) : null;
              const filters = (s.filters ?? {}) as ApolloFilters;
              const rows = filterRows(filters);
              const summary = s.summary || describeFilters(filters);
              return (
                <div key={s.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 truncate">{s.name ?? "—"}</p>
                      {summary && (
                        <p className="text-xs text-zinc-400 mt-0.5 flex items-start gap-1">
                          <span className="text-indigo-400">✦</span>
                          <span>{summary}</span>
                        </p>
                      )}
                      <p className="text-xs text-zinc-500 mt-1">
                        importovano{" "}
                        <span className="text-zinc-300 font-medium">
                          {s.leads_imported.toLocaleString()}/{total ? total.toLocaleString() : "?"}
                        </span>
                        {total ? ` (${pct}%)` : ""}
                        {remaining && remaining > 0 ? ` · ${remaining.toLocaleString()} preostalo` : ""}
                      </p>
                    </div>
                    {(remaining === null || remaining > 0) && (
                      <button
                        onClick={() => { setContinueId(s.id); setShowNewForm(false); setLastResult(null); }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors whitespace-nowrap shrink-0"
                      >
                        Nastavi
                      </button>
                    )}
                  </div>
                  {rows.length > 0 && (
                    <details className="group mt-2">
                      <summary className="flex items-center gap-1 cursor-pointer list-none [&::-webkit-details-marker]:hidden text-xs text-zinc-500 hover:text-zinc-300 select-none w-fit">
                        Prikaži filtere
                        <span className="text-zinc-600 transition-transform group-open:rotate-180 text-[10px]">▾</span>
                      </summary>
                      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                        {rows.map(r => (
                          <div key={r.label} className="contents">
                            <dt className="text-zinc-500 whitespace-nowrap">{r.label}</dt>
                            <dd className="text-zinc-300">{r.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
