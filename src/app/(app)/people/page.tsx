import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

const STATUS_COLORS: Record<string, string> = {
  pending_review: "#BDBDBD",
  approved:       "#FFCC00",
  pushed:         "#A5B4FC",
  active:         "#86EFAC",
  replied:        "#4ADE80",
  completed:      "#BDBDBD",
  rotated_out:    "#FB923C",
  rejected:       "#F87171",
  disqualified:   "#F87171",
};

function first<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser();
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("people")
    .select(`
      id, full_name, first_name, last_name, title, linkedin_url, email,
      companies(name, domain),
      lead_assignments(status, clients(name))
    `)
    .order("full_name")
    .limit(60);

  if (q?.trim()) {
    const term = q.trim();
    query = query.or(
      `full_name.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,linkedin_url.ilike.%${term}%,email.ilike.%${term}%,title.ilike.%${term}%`
    );
  }

  const { data: people } = await query;
  const list = (people ?? []) as any[];

  return (
    <div>
      <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#FFFFFF" }}>People</h1>
      <p style={{ marginTop: "4px", fontSize: "14px", color: "#BDBDBD" }}>
        Globalni registar leadova — svaka osoba deduplicirana po LinkedIn URL-u.
      </p>

      <form method="GET" style={{ marginTop: "20px" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Pretraži po imenu, tituli, LinkedIn URL, e-mailu…"
            autoComplete="off"
            style={{ flex: 1, backgroundColor: "#3B3B3B", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "12px", color: "#FFFFFF", padding: "10px 14px", fontSize: "14px", outline: "none" }}
          />
          <button
            type="submit"
            style={{ backgroundColor: "#FFCC00", color: "#272727", fontWeight: 600, borderRadius: "12px", padding: "10px 20px", fontSize: "14px", border: "none", cursor: "pointer" }}
          >
            Traži
          </button>
        </div>
      </form>

      <div style={{ marginTop: "16px", borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
        <table style={{ minWidth: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#1E1E1E" }}>
              {["Ime", "Titula", "Kompanija", "Klijenti / status", ""].map((h) => (
                <th key={h} style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", padding: "12px 16px", textAlign: "left", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const company = first<any>(p.companies);
              const name =
                p.full_name ||
                `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() ||
                "—";
              const assignments = (
                Array.isArray(p.lead_assignments) ? p.lead_assignments : []
              ) as any[];

              const byClient = new Map<string, { name: string; statuses: string[] }>();
              for (const a of assignments) {
                const client = first<any>(a.clients);
                if (!client) continue;
                const existing = byClient.get(client.name);
                if (existing) existing.statuses.push(a.status);
                else byClient.set(client.name, { name: client.name, statuses: [a.status] });
              }

              return (
                <tr key={p.id} style={{ backgroundColor: "#303030", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: "#FFFFFF", whiteSpace: "nowrap" }}>
                    {name}
                    {p.linkedin_url && (
                      <a
                        href={p.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ marginLeft: "6px", fontSize: "12px", color: "#A5B4FC", textDecoration: "none" }}
                      >
                        ↗
                      </a>
                    )}
                  </td>
                  <td style={{ maxWidth: "180px", padding: "12px 16px", color: "#BDBDBD", overflow: "hidden" }}>
                    <span style={{ display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>{p.title ?? "—"}</span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#BDBDBD", whiteSpace: "nowrap" }}>
                    {company?.name ?? "—"}
                    {company?.domain && (
                      <span style={{ marginLeft: "6px", fontFamily: "monospace", fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{company.domain}</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {[...byClient.entries()].map(([clientName, info]) => {
                        const latest = info.statuses[0] ?? "pending_review";
                        const dotColor = STATUS_COLORS[latest] ?? "#BDBDBD";
                        return (
                          <span
                            key={clientName}
                            style={{ display: "flex", alignItems: "center", gap: "5px", backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "999px", padding: "3px 10px", fontSize: "12px", color: "#BDBDBD" }}
                          >
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: dotColor, flexShrink: 0 }} />
                            {clientName}
                          </span>
                        );
                      })}
                      {byClient.size === 0 && (
                        <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>Nije dodeljen</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <Link
                      href={`/people/${p.id}`}
                      style={{ fontSize: "12px", color: "#FFCC00", textDecoration: "none" }}
                    >
                      Detalji →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && (
          <p style={{ padding: "32px", textAlign: "center", fontSize: "14px", color: "rgba(255,255,255,0.35)" }}>
            {q ? `Nema rezultata za "${q}".` : "Nema leadova u bazi."}
          </p>
        )}
        {list.length === 60 && (
          <p style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "10px 16px", textAlign: "center", fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
            Prikazano prvih 60 — uži pretragu da pronađeš specifičnu osobu.
          </p>
        )}
      </div>
    </div>
  );
}
