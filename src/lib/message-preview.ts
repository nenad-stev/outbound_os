// Renders a sequence step template for a specific lead by filling placeholders.
// Supports {personalization}, {first_name}, {last_name}, {company}, {title}
// (and camelCase variants). Unknown placeholders are left visible so the
// operator can spot gaps.

export interface PreviewLead {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  company_name?: string;
  title?: string;
  personalization?: string;
}

export interface PreviewSegment {
  text: string;
  kind: "text" | "personalization" | "missing";
}

const TOKEN_RE = /\{\s*([a-zA-Z_]+)\s*\}/g;

function resolveToken(token: string, lead: PreviewLead): string | null {
  const key = token.toLowerCase().replace(/_/g, "");
  switch (key) {
    case "personalization":
      return lead.personalization ?? null;
    case "firstname":
      return lead.first_name ?? lead.full_name?.split(" ")[0] ?? null;
    case "lastname":
      return lead.last_name ?? lead.full_name?.split(" ").slice(1).join(" ") ?? null;
    case "fullname":
    case "name":
      return lead.full_name ?? (`${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || null);
    case "company":
    case "companyname":
      return lead.company_name ?? null;
    case "title":
    case "jobtitle":
      return lead.title ?? null;
    default:
      return null;
  }
}

// Split into segments so the UI can highlight the personalized part.
export function renderTemplateSegments(template: string, lead: PreviewLead): PreviewSegment[] {
  const segments: PreviewSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;

  while ((m = TOKEN_RE.exec(template)) !== null) {
    if (m.index > last) {
      segments.push({ text: template.slice(last, m.index), kind: "text" });
    }
    const token = m[1];
    const value = resolveToken(token, lead);
    if (value != null && value !== "") {
      segments.push({
        text: value,
        kind: token.toLowerCase().includes("personal") ? "personalization" : "text",
      });
    } else {
      // Unresolved — show the token so the gap is visible
      segments.push({ text: `{${token}}`, kind: "missing" });
    }
    last = m.index + m[0].length;
  }
  if (last < template.length) {
    segments.push({ text: template.slice(last), kind: "text" });
  }
  return segments;
}

export function renderTemplate(template: string, lead: PreviewLead): string {
  return renderTemplateSegments(template, lead)
    .map((s) => s.text)
    .join("");
}
