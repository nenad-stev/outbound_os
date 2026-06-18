import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { approveFollowupForm, dismissFollowupForm } from "@/app/actions/pools";
import CollectButton from "./CollectButton";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("sr-RS", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function first<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function FollowupPoolPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab = (tab === "approved" || tab === "dismissed") ? tab : "pending";

  const supabase = await createClient();

  const [{ data: clientData }, { data: rows }] = await Promise.all([
    supabase.from("clients").select("id, name").eq("id", id).maybeSingle(),
    supabase
      .from("followup_pool")
      .select(`
        id, status, eligible_at, source_assignment_id,
        people(full_name, first_name, last_name, linkedin_url, title),
        source_campaign:source_campaign_id(name, followup_delay_days),
        source_assignment:source_assignment_id(
          assigned_at,
          connection_status(state, accepted_at)
        )
      `)
      .eq("client_id", id)
      .order("eligible_at", { ascending: false }),
  ]);

  if (!clientData) notFound();

  const all = (rows ?? []) as any[];
  const counts = { pending: 0, approved: 0, dismissed: 0 };
  for (const r of all) counts[r.status as keyof typeof counts]++;
  const filtered = all.filter((r) => r.status === activeTab);

  const tabs = [
    { key: "pending", label: "Na čekanju", count: counts.pending },
    { key: "approved", label: "Odobreni", count: counts.approved },
    { key: "dismissed", label: "Odbačeni", count: counts.dismissed },
  ];

  return (
    <div>
      <Link href={`/clients/${id}`} style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", textDecoration: "none", display: "inline-block", marginBottom: "16px" }}>
        ← {clientData.name}
      </Link>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "8px 0 4px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#FFFFFF" }}>Follow-up Pool</h1>
          <p style={{ marginTop: "4px", fontSize: "13px", color: "rgba(255,255,255,0.35)" }}>
            Prihvatili konekciju, nije odgovoreno — čekaju follow-up kampanju.
          </p>
        </div>
        <CollectButton clientId={id} />
      </div>

      <div style={{ marginTop: "16px", backgroundColor: "rgba(255,204,0,0.08)", border: "1px solid rgba(255,204,0,0.15)", borderRadius: "12px", padding: "12px 16px", color: "#BDBDBD", fontSize: "13px" }}>
        <strong style={{ color: "#FFCC00" }}>Tok:</strong> Označi leadove kao odobrene → Napravi follow-up kampanju (tip: Follow-up) →
        Dodaj ih u novi audience → Puši iz Review Queue-a.
      </div>

      <div style={{ marginTop: "20px", display: "flex", gap: "8px", marginBottom: "16px" }}>
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/clients/${id}/followups?tab=${t.key}`}
            style={activeTab === t.key
              ? { backgroundColor: "#FFCC00", color: "#272727", fontWeight: 600, borderRadius: "999px", padding: "5px 14px", fontSize: "12px", textDecoration: "none" }
              : { backgroundColor: "rgba(255,255,255,0.06)", color: "#BDBDBD", borderRadius: "999px", padding: "5px 14px", fontSize: "12px", textDecoration: "none" }
            }
          >
            {t.label} ({t.count})
          </Link>
        ))}
      </div>

      <div style={{ borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
        <table style={{ minWidth: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#1E1E1E" }}>
              {["Osoba", "Titula", "Kampanja", "Konekcija prihvaćena", "Delay", "Eligible od", "Akcije"].map((h) => (
                <th key={h} style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", padding: "12px 16px", textAlign: "left", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const person = first<any>(r.people) ?? {};
              const campaign = first<any>(r.source_campaign);
              const srcAssignment = first<any>(r.source_assignment);
              const cs = first<any>(srcAssignment?.connection_status);
              const name =
                person.full_name ||
                `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() ||
                "—";

              return (
                <tr key={r.id} style={{ backgroundColor: "#303030", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: "#FFFFFF", whiteSpace: "nowrap" }}>
                    {name}
                    {person.linkedin_url && (
                      <a href={person.linkedin_url} target="_blank" rel="noopener noreferrer"
                        style={{ marginLeft: "6px", fontSize: "12px", color: "#A5B4FC", textDecoration: "none" }}>↗</a>
                    )}
                  </td>
                  <td style={{ maxWidth: "150px", padding: "12px 16px", color: "#BDBDBD" }}>
                    <span style={{ display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>{person.title ?? "—"}</span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#BDBDBD", whiteSpace: "nowrap" }}>
                    {campaign?.name ?? "—"}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: "12px", color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>
                    {fmtDate(cs?.accepted_at ?? null)}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: "12px", color: "#BDBDBD", whiteSpace: "nowrap" }}>
                    {campaign?.followup_delay_days ?? 60}d
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: "12px", color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>
                    {fmtDate(r.eligible_at)}
                  </td>
                  <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                    {activeTab === "pending" && (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <form action={approveFollowupForm}>
                          <input type="hidden" name="poolId" value={r.id} />
                          <input type="hidden" name="clientId" value={id} />
                          <button type="submit"
                            style={{ backgroundColor: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#A5B4FC", borderRadius: "8px", padding: "5px 12px", fontSize: "12px", cursor: "pointer" }}>
                            Odobri
                          </button>
                        </form>
                        <form action={dismissFollowupForm}>
                          <input type="hidden" name="poolId" value={r.id} />
                          <input type="hidden" name="clientId" value={id} />
                          <button type="submit"
                            style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#F87171", borderRadius: "8px", padding: "5px 12px", fontSize: "12px", cursor: "pointer" }}>
                            Odbaci
                          </button>
                        </form>
                      </div>
                    )}
                    {activeTab === "approved" && (
                      <span style={{ fontSize: "12px", color: "#A5B4FC" }}>✓ Spreman za follow-up</span>
                    )}
                    {activeTab === "dismissed" && (
                      <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>– Odbačen</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p style={{ padding: "32px", textAlign: "center", fontSize: "14px", color: "rgba(255,255,255,0.35)" }}>
            {activeTab === "pending"
              ? "Nema leadova koji čekaju follow-up. Klikni \"Skeniraj eligibilne\" da pronađeš nove."
              : "Nema stavki."}
          </p>
        )}
      </div>
    </div>
  );
}
