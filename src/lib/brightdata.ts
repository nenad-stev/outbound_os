import type { RawLinkedInProfile, RawCompanyProfile } from "@/lib/enrichment";
import { linkedinKey } from "@/lib/enrichment";

const BD_BASE = "https://api.brightdata.com";
const PEOPLE_DATASET = "gd_l1viktl72bvl7bjuj0";
const COMPANY_DATASET = "gd_l1vikfnt1wgvvqz95w";

// ---------------------------------------------------------------------------
// Core scrape runner — handles BrightData /datasets/v3/scrape.
// The endpoint is synchronous and returns the data directly, but depending on
// dataset / batch size it may return: a JSON array, NDJSON (one obj per line),
// a single object, or {snapshot_id} (async). We handle all shapes.
// ---------------------------------------------------------------------------
async function runScrape(datasetId: string, urls: string[]): Promise<Record<string, any>[]> {
  const key = process.env.BRIGHTDATA_API_KEY;
  if (!key || urls.length === 0) return [];

  let text: string;
  try {
    const res = await fetch(
      `${BD_BASE}/datasets/v3/scrape?dataset_id=${datasetId}&notify=false&include_errors=true`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ input: urls.map((url) => ({ url })) }),
        signal: AbortSignal.timeout(180_000),
      }
    );
    if (!res.ok) {
      console.error(`[BrightData:${datasetId}] scrape failed:`, res.status, (await res.text()).slice(0, 500));
      return [];
    }
    text = await res.text();
  } catch (e) {
    console.error(`[BrightData:${datasetId}] scrape error:`, e);
    return [];
  }

  // Try JSON first
  try {
    const json = JSON.parse(text);
    if (Array.isArray(json)) return json;
    if (json?.snapshot_id) return await pollSnapshot(datasetId, json.snapshot_id, key);
    if (json && typeof json === "object") return [json];
  } catch {
    // Fall through to NDJSON
  }

  // NDJSON: one JSON object per line
  const rows = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Record<string, any>[];

  return rows;
}

// Fallback for the async case (response returned a snapshot_id instead of data)
async function pollSnapshot(datasetId: string, snapshotId: string, key: string): Promise<Record<string, any>[]> {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 6_000));
    try {
      const res = await fetch(`${BD_BASE}/datasets/v3/snapshot/${snapshotId}?format=json`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 200) {
        const json = await res.json();
        return Array.isArray(json) ? json : [json];
      }
      if (res.status === 202) continue;
      console.error(`[BrightData:${datasetId}] poll status:`, res.status);
      break;
    } catch (e) {
      console.error(`[BrightData:${datasetId}] poll error:`, e);
    }
  }
  return [];
}

function toInt(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseInt(String(v).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function joinMaybeArray(v: unknown): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean).join(", ") || null;
  const s = String(v).trim();
  return s || null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function rowKey(p: Record<string, any>): string | null {
  return linkedinKey(p.input_url ?? p.url ?? null);
}

// ---------------------------------------------------------------------------
// People profiles
// ---------------------------------------------------------------------------
// activity[].interaction looks like "Liked by X", "X commented on…", "Shared …".
// A post/share/repost = content creation; like/comment = engagement only.
const POST_RE = /\b(posted|shared|reposted)\b/i;

function parsePerson(p: Record<string, any>): RawLinkedInProfile {
  const activity: any[] = Array.isArray(p.activity) ? p.activity : [];
  const hasOriginalPost = activity.some((a) => POST_RE.test(String(a?.interaction ?? "")));
  const hasRealPhoto = Boolean(p.avatar) && p.default_avatar !== true;

  return {
    headline: p.position ?? p.headline ?? null,
    about: (p.about ?? p.summary ?? "")?.slice(0, 3000) || null,
    connections: toInt(p.connections),
    followers: toInt(p.followers),
    profile_photo_url: hasRealPhoto ? (p.avatar ?? null) : null,
    has_real_photo: hasRealPhoto,
    activity_count: activity.length,
    has_original_post: hasOriginalPost,
  };
}

export async function scrapeLinkedInProfiles(
  linkedinUrls: string[]
): Promise<Map<string, RawLinkedInProfile>> {
  const unique = [...new Set(linkedinUrls.map((u) => linkedinKey(u)).filter(Boolean))] as string[];
  // Re-expand keys to real URLs for the request (BrightData needs full URLs)
  const urlByKey = new Map<string, string>();
  for (const u of linkedinUrls) {
    const k = linkedinKey(u);
    if (k && !urlByKey.has(k)) urlByKey.set(k, u);
  }
  const rows = await runScrape(PEOPLE_DATASET, [...urlByKey.values()]);
  const map = new Map<string, RawLinkedInProfile>();
  for (const p of rows) {
    if (p.error) continue;
    const key = rowKey(p);
    if (key) map.set(key, parsePerson(p));
  }
  console.log(`[BrightData:people] enriched ${map.size}/${unique.length}`);
  return map;
}

// ---------------------------------------------------------------------------
// Company profiles
// ---------------------------------------------------------------------------
function parseCompany(p: Record<string, any>): RawCompanyProfile {
  // employees is an array of employee objects, not a count — use employees_in_linkedin
  const aboutRaw = p.about ?? p.unformatted_about ?? p.description ?? "";
  return {
    name: p.name ?? p.company_name ?? null,
    about: aboutRaw ? decodeEntities(String(aboutRaw)).slice(0, 3000) : null,
    industry: joinMaybeArray(p.industries ?? p.industry),
    company_size: p.company_size ?? p.size ?? null,
    employee_count: toInt(p.employees_in_linkedin),
    headquarters: joinMaybeArray(p.headquarters ?? p.formatted_locations ?? p.location),
    website: p.website ?? p.website_simplified ?? null,
    founded: p.founded ? String(p.founded) : null,
    specialties: joinMaybeArray(p.specialties),
    followers: toInt(p.followers),
  };
}

export async function scrapeLinkedInCompanies(
  companyUrls: string[]
): Promise<Map<string, RawCompanyProfile>> {
  const urlByKey = new Map<string, string>();
  for (const u of companyUrls) {
    const k = linkedinKey(u);
    if (k && !urlByKey.has(k)) urlByKey.set(k, u);
  }
  const rows = await runScrape(COMPANY_DATASET, [...urlByKey.values()]);
  const map = new Map<string, RawCompanyProfile>();
  for (const p of rows) {
    if (p.error) continue;
    const key = rowKey(p);
    if (key) map.set(key, parseCompany(p));
  }
  console.log(`[BrightData:company] enriched ${map.size}/${urlByKey.size}`);
  return map;
}
