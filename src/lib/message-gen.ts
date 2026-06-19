// Regenerate a per-lead outreach message (the `personalization` value pushed to
// HeyReach as the {personalization} custom variable) from an operator-supplied
// template/brief. Mirrors the Anthropic fetch pattern used in score.ts.

export interface MessageGenLead {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  title?: string;
  company_name?: string;
  industry?: string;
  location?: string;
  bio_text?: string;          // LinkedIn headline
  linkedin_about?: string;
}

export async function generateMessage(
  template: string,
  lead: MessageGenLead,
  anthropicKey: string
): Promise<{ ok: boolean; text: string; error?: string }> {
  const name = lead.full_name || `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim();
  const prompt = `Ti pišeš kratke, personalizovane delove za LinkedIn outreach poruke.

UPUTSTVO / TEMPLATE OD OPERATERA (ispoštuj ton i smisao):
${template}

PODACI O OSOBI:
Ime: ${name || "Nepoznato"}
Pozicija: ${lead.title ?? "Nepoznato"}
Firma: ${lead.company_name ?? "Nepoznato"}
Industrija: ${lead.industry ?? "Nepoznato"}
Lokacija: ${lead.location ?? "Nepoznato"}
${lead.bio_text ? `LinkedIn headline: ${lead.bio_text}` : ""}
${lead.linkedin_about ? `LinkedIn about: ${lead.linkedin_about.slice(0, 1000)}` : ""}

Napiši SAMO tekst koji se ubacuje na mesto {personalization} u poruci — bez pozdrava, bez potpisa, bez navodnika, bez objašnjenja. Maksimalno 1–2 rečenice, prirodno i konkretno za ovu osobu/firmu.`;

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
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return { ok: false, text: "", error: `Anthropic ${res.status}` };
    const json = await res.json();
    const text: string = (json?.content?.[0]?.text ?? "").trim().replace(/^["']|["']$/g, "");
    if (!text) return { ok: false, text: "", error: "Prazan odgovor." };
    return { ok: true, text };
  } catch (e) {
    return { ok: false, text: "", error: e instanceof Error ? e.message : String(e) };
  }
}
