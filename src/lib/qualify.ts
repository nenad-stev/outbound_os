// Qualify cascade: Firecrawl homepage → LinkedIn company about → LinkedIn person about → no_data
// Returns { qualified: boolean; source: string; reason: string; content: string | null }

export interface QualifyResult {
  qualified: boolean;
  source: "website" | "linkedin_company" | "linkedin_person" | "no_data" | "none";
  reason: string;
  content: string | null;
}

import { anthropicText } from "@/lib/anthropic";

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v1";

async function scrapeText(url: string): Promise<string | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const text: string = json?.data?.markdown ?? "";
    return text.slice(0, 3000) || null; // cap to save tokens
  } catch {
    return null;
  }
}

async function compareToIcp(
  content: string,
  targetDescription: string,
  antiTarget: string | null,
  anthropicKey: string
): Promise<{ qualified: boolean; reason: string }> {
  const prompt = `You are an ICP qualifier. Given the company description scraped from their website or LinkedIn, decide if they match the target ICP.

TARGET ICP:
${targetDescription}

${antiTarget ? `ANTI-TARGET (auto-disqualify if matches):\n${antiTarget}\n` : ""}

SCRAPED CONTENT:
${content}

Reply with JSON only: {"qualified": true/false, "reason": "one sentence explanation"}`;

  const text = await anthropicText(
    {
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    },
    anthropicKey
  );

  if (text == null) return { qualified: false, reason: "AI qualification failed." };

  try {
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    return {
      qualified: Boolean(parsed.qualified),
      reason: String(parsed.reason ?? "No reason provided."),
    };
  } catch {
    return { qualified: false, reason: "Could not parse AI response." };
  }
}

export async function qualifyLead(lead: {
  company_domain: string | null;
  company_linkedin_url: string | null;
  linkedin_url: string | null;
  bio_text: string | null; // shortBio from LGM or any pre-scraped text
  company_description?: string | null; // BrightData company About (pre-enriched)
}, icp: {
  target_description: string | null;
  anti_target: string | null;
}): Promise<QualifyResult> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const targetDesc = icp.target_description;

  if (!targetDesc || !anthropicKey) {
    return { qualified: true, source: "no_data", reason: "No ICP description — auto-qualified.", content: null };
  }

  // Step 1: Firecrawl homepage
  if (lead.company_domain) {
    const url = `https://${lead.company_domain}`;
    const content = await scrapeText(url);
    if (content && content.length > 100) {
      const { qualified, reason } = await compareToIcp(content, targetDesc, icp.anti_target, anthropicKey);
      return { qualified, source: "website", reason, content };
    }
  }

  // Step 2: BrightData company About (pre-enriched, no scraping needed)
  if (lead.company_description && lead.company_description.length > 80) {
    const { qualified, reason } = await compareToIcp(lead.company_description, targetDesc, icp.anti_target, anthropicKey);
    return { qualified, source: "linkedin_company", reason, content: lead.company_description };
  }

  // Step 3: shortBio / LinkedIn About (already available from import — no scraping needed)
  if (lead.bio_text && lead.bio_text.length > 50) {
    const { qualified, reason } = await compareToIcp(lead.bio_text, targetDesc, icp.anti_target, anthropicKey);
    return { qualified, source: "linkedin_person", reason, content: lead.bio_text };
  }

  // Step 3: LinkedIn company About (scrape)
  if (lead.company_linkedin_url) {
    const content = await scrapeText(lead.company_linkedin_url);
    if (content && content.length > 100) {
      const { qualified, reason } = await compareToIcp(content, targetDesc, icp.anti_target, anthropicKey);
      return { qualified, source: "linkedin_company", reason, content };
    }
  }

  // Step 4: LinkedIn person profile (scrape)
  if (lead.linkedin_url) {
    const content = await scrapeText(lead.linkedin_url);
    if (content && content.length > 100) {
      const { qualified, reason } = await compareToIcp(content, targetDesc, icp.anti_target, anthropicKey);
      return { qualified, source: "linkedin_person", reason, content };
    }
  }

  // Step 5: No data
  return { qualified: false, source: "none", reason: "Not able to qualify – data not available.", content: null };
}
