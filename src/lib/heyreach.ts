// HeyReach public API client.
// One workspace API key sees ALL LinkedIn sender accounts + campaigns.
// We de-multiplex results back to our sender_profiles via the LinkedIn account id,
// and to people via the lead's LinkedIn profile URL.

const BASE = (process.env.HEYREACH_BASE_URL ?? "https://api.heyreach.io/api/public").replace(/\/$/, "");
const KEY = (process.env.HEYREACH_API_KEY ?? "").trim();

async function hr(path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: body !== undefined ? "POST" : "GET",
    headers: { "X-API-KEY": KEY, "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) {
    const msg = typeof json === "string" ? json.slice(0, 300) : JSON.stringify(json).slice(0, 300);
    throw new Error(`HeyReach ${path} → ${res.status}: ${msg}`);
  }
  return json;
}

function asItems(json: any): any[] {
  return json?.items ?? json?.data ?? (Array.isArray(json) ? json : []);
}

export async function checkApiKey(): Promise<boolean> {
  try {
    await hr("/auth/CheckApiKey");
    return true;
  } catch {
    return false;
  }
}

export interface HrAccount {
  id: string | number;
  label: string;
  raw: any;
}

export async function getLinkedInAccounts(): Promise<HrAccount[]> {
  const json = await hr("/li_account/GetAll", { offset: 0, limit: 100 });
  return asItems(json).map((a) => ({
    id: a.id ?? a.accountId ?? a.linkedInAccountId,
    label: a.emailAddress ?? a.email ?? (`${a.firstName ?? ""} ${a.lastName ?? ""}`.trim() || String(a.id)),
    raw: a,
  }));
}

// Fetch all leads in a HeyReach campaign (paginated).
export async function getCampaignLeads(campaignId: string | number, max = 2000): Promise<any[]> {
  const cid = typeof campaignId === "string" && /^\d+$/.test(campaignId) ? Number(campaignId) : campaignId;
  const out: any[] = [];
  let offset = 0;
  const limit = 100;
  while (offset < max) {
    const json = await hr("/campaign/GetLeadsFromCampaign", { campaignId: cid, offset, limit });
    const items = asItems(json);
    out.push(...items);
    const total = json?.totalCount ?? json?.total ?? out.length;
    offset += limit;
    if (items.length < limit || offset >= total) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Defensive extraction — exact field names vary; try many paths and surface
// what we couldn't read via the sync report's debug sample.
// ---------------------------------------------------------------------------
function deepGet(obj: any, keys: string[]): any {
  const seen = new Set<any>();
  const stack = [obj];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object" || seen.has(cur)) continue;
    seen.add(cur);
    for (const [k, v] of Object.entries(cur)) {
      if (keys.includes(k) && v != null && v !== "") return v;
      if (v && typeof v === "object") stack.push(v);
    }
  }
  return null;
}

// Verified field names from real HeyReach API response (2026-06-18):
//   lead.linkedInUserProfile.profileUrl  — nested object
//   lead.linkedInSenderId                — numeric account id
//   lead.leadConnectionStatus            — "None" | "Connected" | "Withdrawn" | "Declined"
//   lead.leadMessageStatus               — "None" | "Sent" | "Replied"

export function extractLeadProfileUrl(lead: any): string | null {
  // Primary: confirmed nested path
  const nested = lead?.linkedInUserProfile?.profileUrl;
  if (typeof nested === "string" && nested) return nested;
  // Fallback deepGet for any future API shape changes
  const v = deepGet(lead, ["profileUrl", "linkedin_url", "linkedInUrl", "publicProfileUrl", "profile_url"]);
  return typeof v === "string" ? v : null;
}

export function extractLiAccountId(lead: any): string | number | null {
  // Primary: confirmed field name
  if (lead?.linkedInSenderId != null) return lead.linkedInSenderId;
  // Fallback
  return deepGet(lead, [
    "correspondingLinkedInAccountId", "linkedInAccountId", "linkedinAccountId",
    "senderId", "accountId", "liAccountId",
  ]);
}

export interface LeadSignal {
  connected: boolean;
  replied: boolean;
  declined: boolean;
}

export function extractLeadSignal(lead: any): LeadSignal {
  // Confirmed field names
  const connStatus  = String(lead?.leadConnectionStatus ?? "").toUpperCase();
  const msgStatus   = String(lead?.leadMessageStatus    ?? "").toUpperCase();

  const connected = ["CONNECTED", "MESSAGED", "REPLIED"].some((s) => connStatus.includes(s))
    || ["SENT", "REPLIED"].some((s) => msgStatus.includes(s));

  const replied = msgStatus.includes("REPLIED") || msgStatus.includes("REPLY");

  const declined = connStatus.includes("DECLINED") || connStatus.includes("WITHDRAWN");

  return { connected, replied, declined };
}
