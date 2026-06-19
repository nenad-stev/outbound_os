// Fires the n8n LinkedIn scheduling webhook. n8n waits until `scheduled_at`,
// then publishes the post for the given identity and calls `callback_url` back.
// Auth uses the shared SYNC_SECRET (same one the HeyReach sync routes use).

export interface LinkedInSchedulePayload {
  post_id: string;
  sender_profile_id: string;
  full_name: string;
  linkedin_url: string | null;
  content: string;
  scheduled_at: string; // ISO timestamp
}

export async function fireLinkedInSchedule(
  payload: LinkedInSchedulePayload
): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.N8N_LINKEDIN_WEBHOOK_URL;
  if (!url) return { ok: false, error: "N8N_LINKEDIN_WEBHOOK_URL nije podešen." };

  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const callback_url = `${appUrl}/api/content/${payload.post_id}/linkedin`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sync-secret": process.env.SYNC_SECRET ?? "",
      },
      body: JSON.stringify({ ...payload, callback_url }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, error: `n8n webhook vratio ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
