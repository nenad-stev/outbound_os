// Anthropic Messages call with retry on 429 / 5xx (honors Retry-After).
// Used by qualify + score so the higher in-batch concurrency in the pipeline
// doesn't drop leads on transient rate limits. Returns the first content text,
// or null on persistent failure.
export async function anthropicText(
  body: Record<string, unknown>,
  apiKey: string,
  timeoutMs = 30_000
): Promise<string | null> {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        if ((res.status === 429 || res.status >= 500) && attempt < 2) {
          const ra = Number(res.headers.get("retry-after"));
          await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1200 * (attempt + 1));
          continue;
        }
        return null;
      }
      const json = await res.json();
      return (json?.content?.[0]?.text as string) ?? null;
    } catch {
      // Timeout / network — retry with backoff.
      if (attempt < 2) { await sleep(1200 * (attempt + 1)); continue; }
      return null;
    }
  }
  return null;
}
