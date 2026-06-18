// Person enrichment model — identity/dedup, LinkedIn enrichment, derived signals.
// Stored inside audience_members.raw (JSONB) to avoid schema churn during MVP.

// ---------------------------------------------------------------------------
// Canonical shapes
// ---------------------------------------------------------------------------

export interface PersonIdentity {
  person_key: string;                 // stable dedup key (li:... | email:... | name:...)
  first_name: string;
  last_name: string;
  email_normalized: string | null;    // lowercased/trimmed — dedup key
  linkedin_url_normalized: string | null; // normalized — dedup key
  job_title: string | null;
  company: string | null;
  owner: string | null;               // assigned sender profile (operator) name
}

export type EnrichmentStatus = "pending" | "enriched" | "partial" | "no_data" | "error";

export interface LinkedInEnrichment {
  enrichment_status: EnrichmentStatus;
  headline: string | null;
  about: string | null;
  connections: number | null;
  has_200_plus_connections: boolean;
  has_profile_photo: boolean;
  profile_photo_url: string | null;
  posted_last_30_days: boolean;
  latest_post_date: string | null;    // ISO date
  active_last_30_days: boolean;
  activity_score: number;             // 0-100
}

export type DecisionMakerSignal = "yes" | "likely" | "unlikely" | "no" | "unknown";

export interface AiFitFields {
  decision_maker_signal: DecisionMakerSignal;
  role_fit_notes: string | null;
  linkedin_fit_signals: string[];
  linkedin_red_flags: string[];
}

// Post-HeyReach lifecycle (set later, not in pipeline)
export interface LifecycleFields {
  do_not_contact: boolean;
  lifecycle_status: string | null;    // e.g. new | contacted | replied | meeting | won | lost
  heyreach_sync_status: string | null; // e.g. not_synced | pushed | active | failed
}

// ---------------------------------------------------------------------------
// Identity / dedup helpers
// ---------------------------------------------------------------------------

export function normalizeEmail(email: string | null | undefined): string | null {
  const e = email?.trim().toLowerCase();
  return e && e.includes("@") ? e : null;
}

export function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const t = url.trim().toLowerCase().replace(/^http:\/\//, "https://").replace(/\/$/, "");
  return t || null;
}

// Match key for joining BrightData results back to inputs: the LinkedIn path
// slug only, ignoring protocol and country subdomain (il./www./linkedin.com all
// collapse to the same key). e.g. "https://il.linkedin.com/company/ibm/" → "/company/ibm"
export function linkedinKey(url: string | null | undefined): string | null {
  if (!url) return null;
  let s = url.trim().toLowerCase().replace(/^https?:\/\//, "");
  s = s.replace(/^[a-z]{2,3}\.linkedin\.com/, "linkedin.com"); // il./www. → linkedin.com
  const idx = s.indexOf("linkedin.com/");
  if (idx === -1) return null;
  let path = s.slice(idx + "linkedin.com".length);
  path = path.split("?")[0].split("#")[0].replace(/\/$/, "");
  path = path.replace("/organization-guest/company/", "/company/");
  return path || null;
}

export function buildIdentity(raw: {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
  linkedin_url?: string;
  title?: string;
  company_name?: string;
}, owner: string | null): PersonIdentity {
  const linkedin_url_normalized = normalizeLinkedInUrl(raw.linkedin_url);
  const email_normalized = normalizeEmail(raw.email);
  const first = raw.first_name ?? raw.full_name?.split(" ")[0] ?? "";
  const last = raw.last_name ?? raw.full_name?.split(" ").slice(1).join(" ") ?? "";

  const person_key =
    linkedin_url_normalized ? `li:${linkedin_url_normalized}` :
    email_normalized ? `email:${email_normalized}` :
    `name:${`${first} ${last}`.trim().toLowerCase()}|${(raw.company_name ?? "").toLowerCase()}`;

  return {
    person_key,
    first_name: first,
    last_name: last,
    email_normalized,
    linkedin_url_normalized,
    job_title: raw.title ?? null,
    company: raw.company_name ?? null,
    owner,
  };
}

// ---------------------------------------------------------------------------
// Derived LinkedIn signals (from a parsed BrightData profile)
// ---------------------------------------------------------------------------

export interface RawLinkedInProfile {
  headline: string | null;
  about: string | null;
  connections: number | null;
  followers: number | null;
  profile_photo_url: string | null;
  has_real_photo: boolean;       // avatar present AND not the default placeholder
  activity_count: number;        // # of recent activity items returned (LinkedIn shows only recent)
  has_original_post: boolean;    // any recent activity is a post/share/repost (not just like/comment)
}

export interface RawCompanyProfile {
  name: string | null;
  about: string | null;          // description — used by qualify cascade
  industry: string | null;
  company_size: string | null;   // e.g. "1001-5000 employees"
  employee_count: number | null;
  headquarters: string | null;
  website: string | null;
  founded: string | null;
  specialties: string | null;
  followers: number | null;
}

export function deriveLinkedInEnrichment(
  profile: RawLinkedInProfile | null,
  status: EnrichmentStatus
): LinkedInEnrichment {
  if (!profile) {
    return {
      enrichment_status: status,
      headline: null,
      about: null,
      connections: null,
      has_200_plus_connections: false,
      has_profile_photo: false,
      profile_photo_url: null,
      posted_last_30_days: false,
      latest_post_date: null,
      active_last_30_days: false,
      activity_score: 0,
    };
  }

  const connections = profile.connections;
  const has200 = connections != null && connections >= 200;
  const hasPhoto = profile.has_real_photo;
  // BrightData returns only *recent* activity; no timestamps, so presence is the
  // proxy for "active recently" and a post/share is the proxy for "posted recently".
  const active = profile.activity_count > 0;
  const posted = profile.has_original_post;

  // Activity score 0-100
  let score = 0;
  if (hasPhoto) score += 15;
  if (has200) score += 25;
  if (profile.activity_count > 0) score += Math.min(40, profile.activity_count * 10);
  if (posted) score += 20;
  score = Math.min(100, score);

  return {
    enrichment_status: status,
    headline: profile.headline,
    about: profile.about,
    connections,
    has_200_plus_connections: has200,
    has_profile_photo: hasPhoto,
    profile_photo_url: profile.profile_photo_url,
    posted_last_30_days: posted,
    latest_post_date: null, // not provided by this dataset
    active_last_30_days: active,
    activity_score: score,
  };
}

export function emptyLifecycle(): LifecycleFields {
  return {
    do_not_contact: false,
    lifecycle_status: "new",
    heyreach_sync_status: "not_synced",
  };
}
