export interface NormalizedLead {
  first_name: string;
  last_name: string;
  full_name: string;
  title: string | null;
  email: string | null;
  linkedin_url: string | null;
  company_name: string | null;
  company_domain: string | null;
  company_linkedin_url: string | null;
  industry: string | null;
  employee_count: number | null;
  location: string | null;
  bio_text: string | null;
  raw: Record<string, string>;
}

type Format = "apollo" | "lgm" | "unknown";

function detectFormat(headers: string[]): Format {
  const h = headers.map((x) => x.toLowerCase());
  if (h.includes("person linkedin url") || h.includes("company name for emails")) return "apollo";
  if (h.includes("leadid") || h.includes("enrichstatus") || h.includes("jobtitle")) return "lgm";
  return "unknown";
}

function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// LGM encodes LinkedIn URLs as /in/ACwAAA... — keep as-is, they still resolve
function normalizeLinkedIn(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http")) return trimmed;
  if (trimmed.startsWith("linkedin.com")) return `https://www.${trimmed}`;
  return trimmed;
}

function get(row: Record<string, string>, ...keys: string[]): string | null {
  for (const k of keys) {
    const val = row[k]?.trim();
    if (val) return val;
  }
  return null;
}

function normalizeApollo(row: Record<string, string>): NormalizedLead {
  const firstName = get(row, "First Name") ?? "";
  const lastName = get(row, "Last Name") ?? "";
  const empRaw = get(row, "# Employees");
  const cityRaw = get(row, "City");
  const countryRaw = get(row, "Company Country");
  const location = [cityRaw, countryRaw].filter(Boolean).join(", ") || null;

  return {
    first_name: firstName,
    last_name: lastName,
    full_name: [firstName, lastName].filter(Boolean).join(" "),
    title: get(row, "Title"),
    email: get(row, "Email"),
    linkedin_url: normalizeLinkedIn(get(row, "Person Linkedin Url")),
    company_name: get(row, "Company Name"),
    company_domain: extractDomain(get(row, "Website")),
    company_linkedin_url: normalizeLinkedIn(get(row, "Company Linkedin Url")),
    industry: get(row, "Industry"),
    employee_count: empRaw ? parseInt(empRaw, 10) || null : null,
    location,
    bio_text: null,
    raw: row,
  };
}

function normalizeLgm(row: Record<string, string>): NormalizedLead {
  const firstName = get(row, "firstname") ?? "";
  const lastName = get(row, "lastname") ?? "";
  const shortBio = get(row, "shortBio");

  return {
    first_name: firstName,
    last_name: lastName,
    full_name: [firstName, lastName].filter(Boolean).join(" "),
    title: get(row, "jobTitle"),
    email: get(row, "proEmail"),
    linkedin_url: normalizeLinkedIn(get(row, "linkedinUrl")),
    company_name: get(row, "companyName"),
    company_domain: extractDomain(get(row, "companyUrl")),
    company_linkedin_url: null,
    industry: get(row, "industry"),
    employee_count: null,
    location: get(row, "location"),
    bio_text: shortBio && shortBio.length > 50 ? shortBio.slice(0, 3000) : null,
    raw: row,
  };
}

export function parseAndNormalize(csvText: string): {
  leads: NormalizedLead[];
  format: Format;
  skipped: number;
} {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) return { leads: [], format: "unknown", skipped: 0 };

  const headers = rows[0];
  const format = detectFormat(headers);

  const leads: NormalizedLead[] = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    if (values.length === 0) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });

    let lead: NormalizedLead;
    if (format === "apollo") lead = normalizeApollo(row);
    else if (format === "lgm") lead = normalizeLgm(row);
    else {
      skipped++;
      continue;
    }

    if (!lead.linkedin_url && (!lead.company_name || !lead.full_name)) {
      skipped++;
      continue;
    }

    leads.push(lead);
  }

  return { leads, format, skipped };
}

// Full CSV parser — handles multiline quoted fields correctly
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          // Escaped quote
          field += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        // Newlines inside quotes are part of the field
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        row.push(field.trim());
        field = "";
        i++;
      } else if (ch === '\r' && text[i + 1] === '\n') {
        row.push(field.trim());
        field = "";
        if (row.some((v) => v !== "")) rows.push(row);
        row = [];
        i += 2;
      } else if (ch === '\n') {
        row.push(field.trim());
        field = "";
        if (row.some((v) => v !== "")) rows.push(row);
        row = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Last field/row
  if (field || row.length > 0) {
    row.push(field.trim());
    if (row.some((v) => v !== "")) rows.push(row);
  }

  return rows;
}
