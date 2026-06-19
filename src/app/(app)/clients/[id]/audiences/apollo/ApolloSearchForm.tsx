"use client";

import { useState, useRef, useEffect } from "react";
import { EMPLOYEE_RANGES, SENIORITY_LEVELS, APOLLO_INDUSTRIES, type ApolloFilters } from "@/lib/apollo";

interface Campaign { id: string; name: string; sender_name: string | null }
interface IcpProfile { id: string; name: string; is_default: boolean }

interface Props {
  clientId: string;
  campaigns: Campaign[];
  icpProfiles: IcpProfile[];
  onResult: (result: SearchResult) => void;
  // if provided, this is a "continue" run
  existingSearchId?: string;
  existingName?: string;
  // wizard mode: campaign + ICP are pre-chosen upstream, hide the selectors
  fixedCampaignId?: string;
  fixedIcpId?: string;
}

interface SearchResult {
  search_id: string;
  audience_id: string;
  imported: number;
  total_entries: number | null;
  leads_imported_total: number;
  pages_fetched: number;
  remaining: number | null;
  query_sent?: Record<string, unknown>;
  errors?: string[];
}

function SearchableMultiSelect({
  options,
  selected,
  onChange,
  placeholder,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter(o => o.toLowerCase().includes(q)) : options;

  function toggle(opt: string) {
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  }

  return (
    <div ref={ref} className="relative">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selected.map(s => (
            <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-indigo-600 border border-indigo-500 text-white">
              {s}
              <button type="button" onClick={() => toggle(s)} className="text-indigo-200 hover:text-white leading-none">✕</button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => { if (e.key === "Enter") e.preventDefault(); }}
        placeholder={placeholder}
        className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-zinc-500">Nema rezultata</p>
          ) : (
            filtered.map(opt => {
              const isSel = selected.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggle(opt)}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-zinc-800 ${isSel ? "text-indigo-400" : "text-zinc-300"}`}
                >
                  <span>{opt}</span>
                  {isSel && <span className="text-indigo-400">✓</span>}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <details className="group mt-1.5">
      <summary className="flex items-center gap-1 cursor-pointer list-none [&::-webkit-details-marker]:hidden text-xs text-zinc-500 hover:text-zinc-300 select-none w-fit">
        <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-zinc-600 text-[9px] font-semibold leading-none">i</span>
        kako se koristi
        <span className="text-zinc-600 transition-transform group-open:rotate-180 text-[10px]">▾</span>
      </summary>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{children}</p>
    </details>
  );
}

export default function ApolloSearchForm({ clientId, campaigns, icpProfiles, onResult, existingSearchId, existingName, fixedCampaignId, fixedIcpId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [name, setName] = useState(existingName ?? "");
  const [campaignId, setCampaignId] = useState(fixedCampaignId ?? "");
  const [icpId, setIcpId] = useState(fixedIcpId ?? icpProfiles.find(i => i.is_default)?.id ?? "");
  const [titles, setTitles] = useState<string[]>([""]);
  const [includeSimilar, setIncludeSimilar] = useState(true);
  const [seniorities, setSeniorities] = useState<string[]>([]);
  const [personLocations, setPersonLocations] = useState<string[]>([""]);
  const [orgLocations, setOrgLocations] = useState<string[]>([""]);
  const [employeeRanges, setEmployeeRanges] = useState<string[]>([]);
  const [marketSegments, setMarketSegments] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([""]);
  const [limit, setLimit] = useState(200);

  function updateItem(arr: string[], setter: (v: string[]) => void, i: number, val: string) {
    const next = [...arr];
    next[i] = val;
    setter(next);
  }
  function addItem(arr: string[], setter: (v: string[]) => void) {
    setter([...arr, ""]);
  }
  function removeItem(arr: string[], setter: (v: string[]) => void, i: number) {
    setter(arr.filter((_, idx) => idx !== i));
  }

  function toggleVal(arr: string[], setter: (v: string[]) => void, val: string) {
    setter(arr.includes(val) ? arr.filter(r => r !== val) : [...arr, val]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!existingSearchId) {
      if (!campaignId) { setError("Izaberi kampanju."); return; }
      if (!icpId) { setError("Izaberi ICP profil."); return; }
    }

    setLoading(true);
    setError(null);

    const filters: ApolloFilters = {};
    const cleanTitles = titles.map(t => t.trim()).filter(Boolean);
    if (cleanTitles.length) {
      filters.person_titles = cleanTitles;
      filters.include_similar_titles = includeSimilar;
    }
    if (seniorities.length) filters.person_seniorities = seniorities;
    const cleanPersonLocs = personLocations.map(l => l.trim()).filter(Boolean);
    if (cleanPersonLocs.length) filters.person_locations = cleanPersonLocs;
    const cleanOrgLocs = orgLocations.map(l => l.trim()).filter(Boolean);
    if (cleanOrgLocs.length) filters.organization_locations = cleanOrgLocs;
    if (employeeRanges.length) filters.organization_num_employees_ranges = employeeRanges;
    if (marketSegments.length) filters.market_segments = marketSegments;
    const cleanKeywords = keywords.map(k => k.trim()).filter(Boolean);
    if (cleanKeywords.length) filters.q_organization_keyword_tags = cleanKeywords;

    const body = existingSearchId
      ? { client_id: clientId, search_id: existingSearchId, limit }
      : {
          client_id: clientId,
          filters,
          name: name.trim() || undefined,
          campaign_id: campaignId,
          icp_profile_id: icpId,
          limit,
        };

    try {
      const res = await fetch("/api/apollo/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server greška (${res.status}): ${text.slice(0, 200) || "prazan odgovor"}`);
      }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      onResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const isNewSearch = !existingSearchId;

  // Prevent Enter from submitting the form while filling in filter fields
  function blockEnter(e: React.KeyboardEvent) {
    if (e.key === "Enter") e.preventDefault();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {isNewSearch && (
        <>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Naziv searcha</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={blockEnter}
              placeholder="npr. SaaS CEO Beograd"
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />
            <FieldHint>
              Samo interni naziv da prepoznaš ovaj search u listi. Ne utiče na rezultate.
            </FieldHint>
          </div>

          <div className="grid grid-cols-2 gap-3" style={{ display: fixedCampaignId ? "none" : undefined }}>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Kampanja</label>
              <select
                value={campaignId}
                onChange={e => setCampaignId(e.target.value)}
                className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
              >
                <option value="">— izaberi —</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.sender_name ? ` (${c.sender_name})` : ""}
                  </option>
                ))}
              </select>
              <FieldHint>
                Leadovi iz ovog searcha ulaze u izabranu kampanju — ona određuje koji sender ih kontaktira.
              </FieldHint>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">ICP profil</label>
              <select
                value={icpId}
                onChange={e => setIcpId(e.target.value)}
                className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
              >
                <option value="">— izaberi —</option>
                {icpProfiles.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.name}{i.is_default ? " ★" : ""}
                  </option>
                ))}
              </select>
              <FieldHint>
                Profil idealnog kupca po kom se leadovi kasnije AI-kvalifikuju u Review koraku. ★ je default.
              </FieldHint>
            </div>
          </div>
        </>
      )}

      {/* Titule */}
      {isNewSearch && (
        <>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">
              Titule <span className="text-zinc-600">(dodaj više)</span>
            </label>
            <div className="space-y-2">
              {titles.map((t, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={t}
                    onChange={e => updateItem(titles, setTitles, i, e.target.value)}
                    placeholder="CEO, Founder, Head of Sales..."
                    onKeyDown={blockEnter}
                    className="flex-1 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                  />
                  {titles.length > 1 && (
                    <button type="button" onClick={() => removeItem(titles, setTitles, i)}
                      className="px-2 text-zinc-500 hover:text-zinc-300">✕</button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => addItem(titles, setTitles)}
              className="mt-2 text-xs text-zinc-500 hover:text-zinc-300">+ dodaj titulu</button>

            <label className="flex items-center gap-2 mt-3 cursor-pointer">
              <input type="checkbox" checked={includeSimilar}
                onChange={e => setIncludeSimilar(e.target.checked)}
                className="accent-indigo-500" />
              <span className="text-sm text-zinc-400">Uključi slične pozicije</span>
            </label>
            <FieldHint>
              Pozicije koje gađaš — više titula se kombinuje kao OR (bilo koja se računa). Dodaj varijante: CEO, Founder, Owner, Managing Director. „Uključi slične pozicije" proširuje na srodne nazive — ostavi uključeno osim ako ti treba baš tačan naziv.
            </FieldHint>
          </div>

          {/* Seniority (opciono) */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">
              Seniority <span className="text-zinc-600">(opciono — nivo pozicije)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {SENIORITY_LEVELS.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => toggleVal(seniorities, setSeniorities, s.value)}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                    seniorities.includes(s.value)
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <FieldHint>
              Nivo pozicije (OR — izabrani nivoi se sabiraju). Pouzdaniji od titula za gađanje seniora. Opciono — izaberi 1–3. Kombinuje se sa titulama kao dodatni uslov.
            </FieldHint>
          </div>

          {/* Lokacija osobe */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Lokacija osobe</label>
            <div className="space-y-2">
              {personLocations.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={l}
                    onChange={e => updateItem(personLocations, setPersonLocations, i, e.target.value)}
                    placeholder="Serbia, Croatia, Germany..."
                    onKeyDown={blockEnter}
                    className="flex-1 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                  />
                  {personLocations.length > 1 && (
                    <button type="button" onClick={() => removeItem(personLocations, setPersonLocations, i)}
                      className="px-2 text-zinc-500 hover:text-zinc-300">✕</button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => addItem(personLocations, setPersonLocations)}
              className="mt-2 text-xs text-zinc-500 hover:text-zinc-300">+ dodaj lokaciju</button>
            <FieldHint>
              Gde osoba živi (OR među lokacijama). Koristi zemlju ili grad: „Serbia", „Belgrade, Serbia". Izbegavaj da popunjavaš i ovo i lokaciju firme — dve lokacije se kombinuju kao AND i jako sužavaju.
            </FieldHint>
          </div>

          {/* Lokacija firme */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Lokacija firme</label>
            <div className="space-y-2">
              {orgLocations.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={l}
                    onChange={e => updateItem(orgLocations, setOrgLocations, i, e.target.value)}
                    placeholder="United States, United Kingdom..."
                    onKeyDown={blockEnter}
                    className="flex-1 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                  />
                  {orgLocations.length > 1 && (
                    <button type="button" onClick={() => removeItem(orgLocations, setOrgLocations, i)}
                      className="px-2 text-zinc-500 hover:text-zinc-300">✕</button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => addItem(orgLocations, setOrgLocations)}
              className="mt-2 text-xs text-zinc-500 hover:text-zinc-300">+ dodaj lokaciju firme</button>
            <FieldHint>
              Sedište (HQ) kompanije, ne osobe. AND sa lokacijom osobe — popuni samo jedno od to dvoje osim ako baš ciljaš firme iz jedne zemlje sa ljudima iz druge.
            </FieldHint>
          </div>

          {/* Veličina kompanije */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Veličina kompanije</label>
            <div className="flex flex-wrap gap-2">
              {EMPLOYEE_RANGES.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => toggleVal(employeeRanges, setEmployeeRanges, r.value)}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                    employeeRanges.includes(r.value)
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <FieldHint>
              Broj zaposlenih u firmi (OR — izabrani opsezi se sabiraju). „Jeftin" filter koji ne sužava previše — slobodno izaberi više opsega da pokriješ ciljani profil firme.
            </FieldHint>
          </div>

          {/* Industrija (market segments) */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">
              Industrija <span className="text-zinc-600">(pretraži i izaberi — opciono)</span>
            </label>
            <SearchableMultiSelect
              options={APOLLO_INDUSTRIES}
              selected={marketSegments}
              onChange={setMarketSegments}
              placeholder="Kucaj da pretražiš industriju (npr. Software, Banking)..."
            />
            <FieldHint>
              Apollo industrija firme (AND prema ostatku filtera). Kucaj da pretražiš pun spisak, klikni da dodaš. Drži se 0–2 industrije — svaka dodatna sužava rezultat. Za šire pojmove koristi Keywords ispod.
            </FieldHint>
          </div>

          {/* Keywords (OR — više = širi rezultat) */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">
              Keywords <span className="text-zinc-600">(OR — što više, to više rezultata)</span>
            </label>
            <div className="space-y-2">
              {keywords.map((k, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={k}
                    onChange={e => updateItem(keywords, setKeywords, i, e.target.value)}
                    placeholder="cloud, payments, logistics..."
                    onKeyDown={blockEnter}
                    className="flex-1 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                  />
                  {keywords.length > 1 && (
                    <button type="button" onClick={() => removeItem(keywords, setKeywords, i)}
                      className="px-2 text-zinc-500 hover:text-zinc-300">✕</button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => addItem(keywords, setKeywords)}
              className="mt-2 text-xs text-zinc-500 hover:text-zinc-300">+ dodaj keyword</button>
            <FieldHint>
              Ključne reči vezane za firmu (OR) — što više keyworda dodaš, to VIŠE rezultata dobiješ. Koristi za širenje zahvata: „cloud", „payments", „logistics". Suprotno od industrije, ne sužava.
            </FieldHint>
          </div>
        </>
      )}

      {/* Limit */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          Broj leadova ovaj run
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={5000}
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
            className="w-32 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
          />
          <span className="text-xs text-zinc-500">max 5 000 po runu</span>
        </div>
        <FieldHint>
          Koliko leadova da povuče u ovom prolazu. Svaki povučeni lead troši 1 Apollo kredit (otkrivanje LinkedIn profila). Ako search ima više dostupnih, ostatak možeš povući kasnije preko „Nastavi".
        </FieldHint>
      </div>

      {error && (
        <div className="rounded-lg bg-red-900/30 border border-red-700 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium text-white transition-colors"
      >
        {loading
          ? "Importujem... (može potrajati)"
          : existingSearchId
          ? `Nastavi import (još ${limit} leadova)`
          : "Pokreni search"}
      </button>
    </form>
  );
}
