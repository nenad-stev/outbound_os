// Shared CSV export for audience leads. Flattens the `raw` jsonb (nested objects
// → dot-keyed columns, primitive arrays joined, object arrays JSON-stringified)
// so no field is lost, and emits a union of all columns across rows.

export interface CsvMember {
  qualify_status?: string | null;
  qualify_source?: string | null;
  qualify_reason?: string | null;
  review_status?: string | null;
  raw?: any;
}

function flatten(obj: any, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  if (obj == null || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v == null) out[key] = "";
    else if (Array.isArray(v)) {
      out[key] = v.every((x) => x == null || typeof x !== "object")
        ? v.map((x) => (x == null ? "" : String(x))).join("; ")
        : JSON.stringify(v);
    } else if (typeof v === "object") {
      flatten(v, key, out);
    } else {
      out[key] = String(v);
    }
  }
  return out;
}

function csvCell(v: string): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const META_FIELDS = ["qualify_status", "qualify_source", "qualify_reason", "review_status"] as const;

export function buildLeadsCsv(members: CsvMember[]): string {
  const rows = members.map((m) => {
    const meta: Record<string, string> = {};
    for (const f of META_FIELDS) {
      if (m[f] != null) meta[f] = String(m[f]);
    }
    return { ...meta, ...flatten(m.raw ?? {}) };
  });

  // Common, human-useful columns first; everything else alphabetical after.
  const PRIORITY = [
    "qualify_status", "review_status", "qualify_source", "qualify_reason",
    "full_name", "first_name", "last_name", "title", "email", "linkedin_url",
    "company_name", "company_domain", "company_linkedin_url", "industry",
    "employee_count", "location",
    "fit_score", "priority", "decision_maker_signal", "score_explanation", "personalization",
  ];
  const keySet = new Set<string>();
  for (const row of rows) for (const k of Object.keys(row)) keySet.add(k);
  const rest = [...keySet].filter((k) => !PRIORITY.includes(k)).sort();
  const headers = [...PRIORITY.filter((k) => keySet.has(k)), ...rest];

  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell((row as any)[h] ?? "")).join(","));
  }
  return lines.join("\r\n");
}

export function downloadCsv(filename: string, members: CsvMember[]): void {
  // Prepend UTF-8 BOM so Excel reads š/č/ć/ž correctly.
  const csv = "﻿" + buildLeadsCsv(members);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
