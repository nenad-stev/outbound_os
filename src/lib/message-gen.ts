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

interface RenderStep {
  step_order: number;
  label: string;        // "Poruka 1", "Connection request"…
  template_text: string;
}

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";

// Render full per-lead messages for every sequence step in ONE AI call.
// Keeps the operator's template verbatim, fills [bracketed] slots with
// personalized Serbian text, substitutes {placeholders} (names in correct
// Serbian VOCATIVE case), and writes everything in Serbian.
export async function renderLeadMessages(
  steps: RenderStep[],
  lead: MessageGenLead,
  anthropicKey: string,
  extraBrief?: string
): Promise<{ ok: boolean; messages: Record<string, string>; error?: string }> {
  const name = lead.full_name || `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim();
  const usable = steps.filter((s) => (s.template_text ?? "").trim());
  if (usable.length === 0) return { ok: false, messages: {}, error: "Nema template-a u sekvenci." };

  const stepsBlock = usable
    .map((s) => `${s.step_order}. (${s.label}): ${s.template_text}`)
    .join("\n");

  const prompt = `Ti si copywriter za B2B LinkedIn outreach.

Dobijaš poruke iz sekvence. Za SVAKU vrati finalnu verziju po ovim pravilima:
1. JEZIK: piši na ISTOM jeziku na kom je napisan template te poruke. Ako je template na engleskom → ceo tekst na engleskom; ako je na srpskom → na srpskom. Ne prevodi i ne menjaj jezik.
2. Zadrži tekst i ton tačno kako jeste — ne preuređuj rečenice koje nisu u zagradama.
3. Tekst u UGLASTIM zagradama [ ... ] je uputstvo šta treba da napišeš na tom mestu. Zameni CELU zagradu (sa [ i ]) kratkim, konkretnim, personalizovanim tekstom (na jeziku template-a) za ovu osobu/firmu. NIKAD ne ostavljaj uglaste zagrade u rezultatu.
4. Vitičaste oznake {first_name}, {company}, {title} itd. zameni stvarnim podacima osobe.
5. Ako je jezik te poruke SRPSKI, imena osoba MORAJU biti u pravilnom srpskom VOKATIVU pri oslovljavanju. Primeri: "Zdravo {first_name}" → "Zdravo Vladimire" (Vladimir), "Zdravo Marko" → "Zdravo Marko", "Zdravo Miloš" → "Zdravo Miloše", "Zdravo Stefan" → "Zdravo Stefane", "Zdravo Ana" → "Zdravo Ana", "Zdravo Nikola" → "Zdravo Nikola". Ako je jezik engleski, ime ostavi kako jeste (nominativ).
6. Bez navodnika oko cele poruke, bez potpisa, bez objašnjenja.
${extraBrief ? `7. Dodatno uputstvo za stil/sadržaj personalizacije: ${extraBrief}\n` : ""}
PODACI O OSOBI:
Ime: ${name || "Nepoznato"}
Pozicija: ${lead.title ?? "Nepoznato"}
Firma: ${lead.company_name ?? "Nepoznato"}
Industrija: ${lead.industry ?? "Nepoznato"}
Lokacija: ${lead.location ?? "Nepoznato"}
${lead.bio_text ? `LinkedIn headline: ${lead.bio_text}` : ""}
${lead.linkedin_about ? `LinkedIn about: ${lead.linkedin_about.slice(0, 1000)}` : ""}

PORUKE:
${stepsBlock}

Vrati SAMO JSON objekat gde je ključ broj poruke (kao string), a vrednost finalni tekst. Primer: {"1": "...", "2": "..."}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(40_000),
    });
    if (!res.ok) return { ok: false, messages: {}, error: `Anthropic ${res.status}` };
    const json = await res.json();
    const text: string = json?.content?.[0]?.text ?? "{}";
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    const messages: Record<string, string> = {};
    for (const s of usable) {
      const v = parsed[String(s.step_order)] ?? parsed[s.step_order];
      if (typeof v === "string" && v.trim()) messages[String(s.step_order)] = v.trim();
    }
    if (Object.keys(messages).length === 0) return { ok: false, messages: {}, error: "Prazan odgovor." };
    return { ok: true, messages };
  } catch (e) {
    return { ok: false, messages: {}, error: e instanceof Error ? e.message : String(e) };
  }
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
