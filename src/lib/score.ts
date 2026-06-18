// AI scoring: takes qualified lead + ICP → fit score 1-100, priority tier, explanation, personalization sentence

import type { DecisionMakerSignal } from "@/lib/enrichment";

export interface ScoreResult {
  fit_score: number;
  priority: "tier_1" | "tier_2" | "tier_3" | "tier_4";
  explanation: string;
  personalization: string;
  decision_maker_signal: DecisionMakerSignal;
  role_fit_notes: string | null;
  linkedin_fit_signals: string[];
  linkedin_red_flags: string[];
}

export async function scoreLead(lead: {
  first_name: string;
  last_name: string;
  title: string | null;
  company_name: string | null;
  industry: string | null;
  employee_count: number | null;
  location: string | null;
  qualify_content: string | null; // scraped text from qualify step
  linkedin_headline?: string | null;
  linkedin_about?: string | null;
}, icp: {
  target_description: string | null;
  target_roles: string[];
  good_signals: string[];
  bad_signals: string[];
  weight_overrides: { icp_fit: number; signal: number; engagement: number };
  must_have: { field: string; value: string }[];
  must_not: { field: string; value: string }[];
}): Promise<ScoreResult> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicKey) {
    return {
      fit_score: 50,
      priority: "tier_3",
      explanation: "No Anthropic API key — default score assigned.",
      personalization: "",
      decision_maker_signal: "unknown",
      role_fit_notes: null,
      linkedin_fit_signals: [],
      linkedin_red_flags: [],
    };
  }

  const weights = icp.weight_overrides ?? { icp_fit: 40, signal: 35, engagement: 25 };

  const prompt = `You are a B2B lead scoring agent. Score this lead against the ICP and return JSON.

ICP DEFINITION:
${icp.target_description ?? "Not specified"}

Target roles: ${icp.target_roles.join(", ") || "Any"}
Good signals: ${icp.good_signals.join(", ") || "None specified"}
Bad signals: ${icp.bad_signals.join(", ") || "None specified"}
Must-have: ${icp.must_have.map((r) => `${r.field}: ${r.value}`).join("; ") || "None"}
Must-not: ${icp.must_not.map((r) => `${r.field}: ${r.value}`).join("; ") || "None"}

Scoring weights (total 100):
- ICP fit: ${weights.icp_fit} pts
- Signal strength: ${weights.signal} pts
- Engagement potential: ${weights.engagement} pts

LEAD:
Name: ${lead.first_name} ${lead.last_name}
Title: ${lead.title ?? "Unknown"}
Company: ${lead.company_name ?? "Unknown"}
Industry: ${lead.industry ?? "Unknown"}
Employees: ${lead.employee_count ?? "Unknown"}
Location: ${lead.location ?? "Unknown"}
${lead.linkedin_headline ? `LinkedIn headline: ${lead.linkedin_headline}` : ""}
${lead.linkedin_about ? `LinkedIn about: ${lead.linkedin_about.slice(0, 1200)}` : ""}
${lead.qualify_content ? `\nScraped context:\n${lead.qualify_content.slice(0, 1500)}` : ""}

Return JSON only:
{
  "fit_score": <number 1-100>,
  "priority": <"tier_1"|"tier_2"|"tier_3"|"tier_4">,
  "explanation": "<1-2 sentence explanation of score>",
  "personalization": "<1 sentence for outreach, referencing a specific signal or company detail, max 20 words, casual tone>",
  "decision_maker_signal": <"yes"|"likely"|"unlikely"|"no"> based on whether this person can authorize a purchase for the target offer,
  "role_fit_notes": "<1 sentence on how their role fits the target roles>",
  "linkedin_fit_signals": ["<short positive signal from their profile matching the ICP>", ...],
  "linkedin_red_flags": ["<short concern/mismatch from their profile>", ...]
}

Tiers: tier_1=80-100, tier_2=60-79, tier_3=40-59, tier_4=0-39
Keep linkedin_fit_signals and linkedin_red_flags to max 3 items each, empty arrays if none.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    return {
      fit_score: 50, priority: "tier_3", explanation: "Scoring API error.", personalization: "",
      decision_maker_signal: "unknown", role_fit_notes: null, linkedin_fit_signals: [], linkedin_red_flags: [],
    };
  }

  const json = await res.json();
  const text: string = json?.content?.[0]?.text ?? "{}";

  try {
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    const score = Math.max(1, Math.min(100, Number(parsed.fit_score ?? 50)));
    const priority = (["tier_1", "tier_2", "tier_3", "tier_4"].includes(parsed.priority)
      ? parsed.priority
      : score >= 80 ? "tier_1" : score >= 60 ? "tier_2" : score >= 40 ? "tier_3" : "tier_4") as ScoreResult["priority"];

    const dmRaw = String(parsed.decision_maker_signal ?? "unknown");
    const decision_maker_signal = (["yes", "likely", "unlikely", "no"].includes(dmRaw)
      ? dmRaw
      : "unknown") as DecisionMakerSignal;
    const toStrArray = (v: unknown): string[] =>
      Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean).slice(0, 3) : [];

    return {
      fit_score: score,
      priority,
      explanation: String(parsed.explanation ?? ""),
      personalization: String(parsed.personalization ?? ""),
      decision_maker_signal,
      role_fit_notes: parsed.role_fit_notes ? String(parsed.role_fit_notes) : null,
      linkedin_fit_signals: toStrArray(parsed.linkedin_fit_signals),
      linkedin_red_flags: toStrArray(parsed.linkedin_red_flags),
    };
  } catch {
    return {
      fit_score: 50, priority: "tier_3", explanation: "Could not parse score.", personalization: "",
      decision_maker_signal: "unknown", role_fit_notes: null, linkedin_fit_signals: [], linkedin_red_flags: [],
    };
  }
}
