export interface ApolloFilters {
  person_titles?: string[];
  include_similar_titles?: boolean;
  person_seniorities?: string[];
  person_locations?: string[];
  organization_locations?: string[];
  organization_num_employees_ranges?: string[];
  market_segments?: string[];           // industry — matched against employer tags + name
  q_organization_keyword_tags?: string[]; // keywords — OR among tags, broadens results
  q_keywords?: string;
}

export interface ApolloSearchResult {
  people: ApolloPersonPreview[];
  // api_search returns the match count at the TOP LEVEL (not under `pagination`).
  total_entries: number;
}

// Preview from api_search (no linkedin_url, last_name obfuscated)
export interface ApolloPersonPreview {
  id: string;
  first_name: string | null;
  title: string | null;
  organization?: { name: string | null } | null;
}

// Full record from bulk_match (includes linkedin_url)
export interface ApolloPerson {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  title: string | null;
  headline: string | null;
  linkedin_url: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  organization?: {
    id: string;
    name: string | null;
    website_url: string | null;
    linkedin_url: string | null;
    primary_domain: string | null;
    industry: string | null;
    estimated_num_employees: number | null;
  } | null;
}

// Convert an Apollo person into the NormalizedLead-shaped `raw` the pipeline expects.
export function apolloToNormalized(p: ApolloPerson): Record<string, any> {
  const org = p.organization ?? null;
  const firstName = p.first_name ?? "";
  const lastName = p.last_name ?? "";
  const location = [p.city, p.state, p.country].filter(Boolean).join(", ") || null;

  return {
    first_name: firstName,
    last_name: lastName,
    full_name: p.name ?? [firstName, lastName].filter(Boolean).join(" "),
    title: p.title ?? null,
    email: null,
    linkedin_url: p.linkedin_url?.replace(/\/$/, "") ?? null,
    company_name: org?.name ?? null,
    company_domain: org?.primary_domain ?? null,
    company_linkedin_url: org?.linkedin_url?.replace(/\/$/, "") ?? null,
    industry: org?.industry ?? null,
    employee_count: org?.estimated_num_employees ?? null,
    location,
    bio_text: p.headline ?? null,
    apollo_id: p.id,
    source: "apollo",
  };
}

export function buildParams(filters: ApolloFilters, page: number, perPage: number) {
  const params: Record<string, unknown> = { page, per_page: perPage };

  if (filters.person_titles?.length) {
    params.person_titles = filters.person_titles;
    // Apollo's correct param is `include_similar_titles` (defaults to true).
    params.include_similar_titles = filters.include_similar_titles ?? true;
  }
  if (filters.person_seniorities?.length)      params.person_seniorities = filters.person_seniorities;
  if (filters.person_locations?.length)        params.person_locations = filters.person_locations;
  if (filters.organization_locations?.length)  params.organization_locations = filters.organization_locations;
  if (filters.organization_num_employees_ranges?.length) {
    params.organization_num_employees_ranges = filters.organization_num_employees_ranges;
  }
  if (filters.market_segments?.length)         params.market_segments = filters.market_segments;
  if (filters.q_organization_keyword_tags?.length) {
    params.q_organization_keyword_tags = filters.q_organization_keyword_tags;
  }
  if (filters.q_keywords?.trim()) params.q_keywords = filters.q_keywords.trim();

  return params;
}

async function apolloPost(path: string, body: unknown): Promise<any> {
  const res = await fetch(`https://api.apollo.io/v1/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": process.env.APOLLO_API_KEY!,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!text) throw new Error(`Apollo ${path} ${res.status}: empty response`);

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Apollo ${path} ${res.status}: invalid JSON — ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    throw new Error(`Apollo ${path} ${res.status}: ${json?.error ?? json?.message ?? text.slice(0, 200)}`);
  }

  return json;
}

// Step 1: search (free, no credits) — returns preview + total count
export async function apolloSearchPeople(
  filters: ApolloFilters,
  page: number,
  perPage = 100
): Promise<ApolloSearchResult> {
  const params = buildParams(filters, page, perPage);
  console.log("[apollo] api_search params →", JSON.stringify(params));
  return apolloPost("mixed_people/api_search", params);
}

// Step 2: reveal full data including linkedin_url (1 credit per unique person)
// Apollo bulk_match accepts max 10 per call
export async function apolloBulkMatch(apolloIds: string[]): Promise<ApolloPerson[]> {
  if (!apolloIds.length) return [];

  const BATCH = 10;
  const results: ApolloPerson[] = [];

  for (let i = 0; i < apolloIds.length; i += BATCH) {
    const batch = apolloIds.slice(i, i + BATCH);
    const data = await apolloPost("people/bulk_match", {
      details: batch.map(id => ({ id })),
      reveal_personal_emails: false,
    });
    const matches: any[] = data.matches ?? [];
    for (const m of matches) {
      if (m?.linkedin_url) results.push(m as ApolloPerson);
    }
  }

  return results;
}

// Seniority levels accepted by Apollo's person_seniorities filter
export const SENIORITY_LEVELS = [
  { value: "owner",    label: "Owner" },
  { value: "founder",  label: "Founder" },
  { value: "c_suite",  label: "C-Suite" },
  { value: "partner",  label: "Partner" },
  { value: "vp",       label: "VP" },
  { value: "head",     label: "Head" },
  { value: "director", label: "Director" },
  { value: "manager",  label: "Manager" },
  { value: "senior",   label: "Senior" },
  { value: "entry",    label: "Entry" },
  { value: "intern",   label: "Intern" },
];

// Full Apollo industry taxonomy. Fed into the market_segments filter, which
// matches against the employer's tags + name.
export const APOLLO_INDUSTRIES = [
  "Accounting", "Agriculture", "Airlines/Aviation", "Alternative Dispute Resolution",
  "Alternative Medicine", "Animation", "Apparel & Fashion", "Architecture & Planning",
  "Arts & Crafts", "Automotive", "Aviation & Aerospace", "Banking", "Biotechnology",
  "Broadcast Media", "Building Materials", "Business Supplies & Equipment", "Capital Markets",
  "Chemicals", "Civic & Social Organization", "Civil Engineering", "Commercial Real Estate",
  "Computer & Network Security", "Computer Games", "Computer Hardware", "Computer Networking",
  "Computer Software", "Construction", "Consumer Electronics", "Consumer Goods",
  "Consumer Services", "Cosmetics", "Dairy", "Defense & Space", "Design", "E-Learning",
  "Education Management", "Electrical/Electronic Manufacturing", "Entertainment",
  "Environmental Services", "Events Services", "Executive Office", "Facilities Services",
  "Farming", "Financial Services", "Fine Art", "Fishery", "Food & Beverages", "Food Production",
  "Fund-Raising", "Furniture", "Gambling & Casinos", "Glass, Ceramics & Concrete",
  "Government Administration", "Government Relations", "Graphic Design",
  "Health, Wellness & Fitness", "Higher Education", "Hospital & Health Care", "Hospitality",
  "Human Resources", "Import & Export", "Individual & Family Services", "Industrial Automation",
  "Information Services", "Information Technology & Services", "Insurance",
  "International Affairs", "International Trade & Development", "Internet", "Investment Banking",
  "Investment Management", "Judiciary", "Law Enforcement", "Law Practice", "Legal Services",
  "Legislative Office", "Leisure, Travel & Tourism", "Libraries", "Logistics & Supply Chain",
  "Luxury Goods & Jewelry", "Machinery", "Management Consulting", "Maritime", "Market Research",
  "Marketing & Advertising", "Mechanical or Industrial Engineering", "Media Production",
  "Medical Devices", "Medical Practice", "Mental Health Care", "Military", "Mining & Metals",
  "Motion Pictures & Film", "Museums & Institutions", "Music", "Nanotechnology", "Newspapers",
  "Nonprofit Organization Management", "Oil & Energy", "Online Media", "Outsourcing/Offshoring",
  "Package/Freight Delivery", "Packaging & Containers", "Paper & Forest Products",
  "Performing Arts", "Pharmaceuticals", "Philanthropy", "Photography", "Plastics",
  "Political Organization", "Primary/Secondary Education", "Printing",
  "Professional Training & Coaching", "Program Development", "Public Policy",
  "Public Relations & Communications", "Public Safety", "Publishing", "Railroad Manufacture",
  "Ranching", "Real Estate", "Recreational Facilities & Services", "Religious Institutions",
  "Renewables & Environment", "Research", "Restaurants", "Retail", "Security & Investigations",
  "Semiconductors", "Shipbuilding", "Sporting Goods", "Sports", "Staffing & Recruiting",
  "Supermarkets", "Telecommunications", "Textiles", "Think Tanks", "Tobacco",
  "Translation & Localization", "Transportation/Trucking/Railroad", "Utilities",
  "Venture Capital & Private Equity", "Veterinary", "Warehousing", "Wholesale",
  "Wine & Spirits", "Wireless", "Writing & Editing",
];

// ── Human-readable filter summaries ──────────────────────────────────────────

export interface FilterRow { label: string; value: string }

// Turn raw ApolloFilters into labeled rows for display (uses preset labels).
export function filterRows(filters: ApolloFilters): FilterRow[] {
  const seniorityLabel = (v: string) =>
    SENIORITY_LEVELS.find(s => s.value === v)?.label ?? v;
  const sizeLabel = (v: string) =>
    EMPLOYEE_RANGES.find(r => r.value === v)?.label ?? v;

  const rows: FilterRow[] = [];
  if (filters.person_titles?.length) {
    rows.push({ label: "Titule", value: filters.person_titles.join(", ") });
    rows.push({ label: "Slične pozicije", value: filters.include_similar_titles === false ? "ne" : "da" });
  }
  if (filters.person_seniorities?.length)
    rows.push({ label: "Seniority", value: filters.person_seniorities.map(seniorityLabel).join(", ") });
  if (filters.person_locations?.length)
    rows.push({ label: "Lokacija osobe", value: filters.person_locations.join(", ") });
  if (filters.organization_locations?.length)
    rows.push({ label: "Lokacija firme", value: filters.organization_locations.join(", ") });
  if (filters.organization_num_employees_ranges?.length)
    rows.push({ label: "Veličina", value: filters.organization_num_employees_ranges.map(sizeLabel).join(", ") });
  if (filters.market_segments?.length)
    rows.push({ label: "Industrija", value: filters.market_segments.join(", ") });
  if (filters.q_organization_keyword_tags?.length)
    rows.push({ label: "Keywords", value: filters.q_organization_keyword_tags.join(", ") });
  if (filters.q_keywords?.trim())
    rows.push({ label: "Pretraga", value: filters.q_keywords.trim() });
  return rows;
}

// Deterministic one-line description (fallback when AI summary is unavailable).
export function describeFilters(filters: ApolloFilters): string {
  const rows = filterRows(filters).filter(r => r.label !== "Slične pozicije");
  if (!rows.length) return "Bez filtera (svi rezultati)";
  return rows.map(r => r.value).join(" · ");
}

// Very short AI summary of who a search targets. Falls back to describeFilters.
export async function summarizeSearchAI(filters: ApolloFilters): Promise<string> {
  const fallback = describeFilters(filters);
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return fallback;

  const desc = filterRows(filters).map(r => `${r.label}: ${r.value}`).join("\n");
  if (!desc) return fallback;

  const prompt = `Na osnovu Apollo search filtera napiši VEOMA kratak opis ciljne publike na srpskom — jedna rečenica, maksimalno 12 reči. Opiši KOGA ovaj search hvata (persona + tip firme), tako da korisnik kasnije zna koga je ubacio. Bez uvoda i bez navodnika.

FILTERI:
${desc}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
        max_tokens: 60,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return fallback;
    const json = await res.json();
    const text: string = (json?.content?.[0]?.text ?? "").trim();
    return text || fallback;
  } catch {
    return fallback;
  }
}

// Employee range presets shown in the UI
export const EMPLOYEE_RANGES = [
  { label: "1–10",       value: "1,10" },
  { label: "11–50",      value: "11,50" },
  { label: "51–200",     value: "51,200" },
  { label: "201–500",    value: "201,500" },
  { label: "501–1 000",  value: "501,1000" },
  { label: "1 001–5 000",value: "1001,5000" },
  { label: "5 001–10 000",value:"5001,10000" },
  { label: "10 000+",    value: "10001," },
];
