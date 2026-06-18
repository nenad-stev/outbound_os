import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SyncButton from "./SyncButton";

function statusBadge(status: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    pending_review: { backgroundColor: "rgba(255,255,255,0.08)", color: "#BDBDBD" },
    approved:       { backgroundColor: "rgba(255,204,0,0.15)", color: "#FFCC00" },
    pushed:         { backgroundColor: "rgba(99,102,241,0.15)", color: "#A5B4FC" },
    active:         { backgroundColor: "rgba(255,204,0,0.15)", color: "#FFCC00" },
    replied:        { backgroundColor: "rgba(134,239,172,0.12)", color: "#86EFAC" },
    completed:      { backgroundColor: "rgba(134,239,172,0.12)", color: "#86EFAC" },
    rotated_out:    { backgroundColor: "rgba(251,146,60,0.12)", color: "#FB923C" },
    rejected:       { backgroundColor: "rgba(239,68,68,0.08)", color: "#F87171" },
    disqualified:   { backgroundColor: "rgba(239,68,68,0.08)", color: "#F87171" },
  };
  return { ...(map[status] ?? map.pending_review), borderRadius: "999px", padding: "3px 10px", fontSize: "11px", fontWeight: 500 };
}

function connBadge(state: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    not_sent:  { backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)" },
    requested: { backgroundColor: "rgba(99,102,241,0.12)", color: "#A5B4FC" },
    accepted:  { backgroundColor: "rgba(134,239,172,0.12)", color: "#86EFAC" },
    withdrawn: { backgroundColor: "rgba(251,146,60,0.12)", color: "#FB923C" },
    declined:  { backgroundColor: "rgba(239,68,68,0.08)", color: "#F87171" },
  };
  return { ...(map[state] ?? map.not_sent), borderRadius: "999px", padding: "3px 10px", fontSize: "11px", fontWeight: 500 };
}

const CONN_LABELS: Record<string, string> = {
  not_sent: "Nije poslato", requested: "Poslat zahtev", accepted: "Prihvaćeno",
  withdrawn: "Povučeno", declined: "Odbijeno",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("sr-RS", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function firstOf<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function ClientLedgerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { id } = await params;
  const { status } = await searchParams;
  const supabase = await createClient();

  const [{ data: clientData }, { data: rows }] = await Promise.all([
    supabase.from("clients").select("id, name").eq("id", id).maybeSingle(),
    supabase
      .from("lead_assignments")
      .select(`
        id, status, rotation_round, assigned_at, company_id,
        people(full_name, first_name, last_name, linkedin_url, title),
        companies(name, domain),
        campaigns(name),
        sender_profiles(full_name),
        connection_status(state, requested_at, accepted_at, withdrawn_at)
      `)
      .eq("client_id", id)
      .order("assigned_at", { ascending: false }),
  ]);

  if (!clientData) notFound();
  const assignments = (rows ?? []) as any[];

  const LIVE = new Set(["pushed", "active", "replied"]);
  const liveByCompany = new Map<string, number>();
  for (const a of assignments) {
    if (a.company_id && LIVE.has(a.status)) {
      liveByCompany.set(a.company_id, (liveByCompany.get(a.company_id) ?? 0) + 1);
    }
  }

  const counts = assignments.reduce((acc: Record<string, number>, a: any) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  const tabs = [
    { key: "", label: "Svi", count: assignments.length },
    { key: "pushed", label: "Pushed", count: counts["pushed"] ?? 0 },
    { key: "active", label: "Active", count: counts["active"] ?? 0 },
    { key: "replied", label: "Replied", count: counts["replied"] ?? 0 },
    { key: "completed", label: "Completed", count: counts["completed"] ?? 0 },
    { key: "rotated_out", label: "Rotated out", count: counts["rotated_out"] ?? 0 },
  ];

  const filtered = status ? assignments.filter((a) => a.status === status) : assignments;
  const overlapCount = [...liveByCompany.values()].filter((n) => n > 1).length;

  return (
    <div>
      <Link href={`/clients/${id}`} style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", textDecoration: "none", display: "inline-block", marginBottom: "16px" }}>
        ← {clientData.name}
      </Link>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "8px 0 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#FFFFFF" }}>Prospect Ledger</h1>
          <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)" }}>{assignments.length} dodela</span>
        </div>
        <SyncButton clientId={id} />
      </div>
      <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginBottom: "20px" }}>
        Svaki lead dodeljen ovom klijentu — kroz koju kampanju, koji sender, status veze i rotacija.
        {overlapCount > 0 && (
          <span style={{ marginLeft: "6px", color: "#FB923C" }}>⚠ {overlapCount} firmi sa istovremenim kontaktom iz 2+ profila.</span>
        )}
      </p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/clients/${id}/ledger${t.key ? `?status=${t.key}` : ""}`}
            style={(status ?? "") === t.key
              ? { backgroundColor: "#FFCC00", color: "#272727", fontWeight: 600, borderRadius: "999px", padding: "5px 14px", fontSize: "12px", textDecoration: "none" }
              : { backgroundColor: "rgba(255,255,255,0.06)", color: "#BDBDBD", borderRadius: "999px", padding: "5px 14px", fontSize: "12px", textDecoration: "none" }
            }
          >
            {t.label} ({t.count})
          </Link>
        ))}
      </div>

      {/* Table */}
      <div style={{ borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
        <table style={{ minWidth: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "#1E1E1E" }}>
              {["Ime", "Kompanija", "Titula", "Sender", "Kampanja", "Status", "Konekcija", "Rot.", "Dodeljen"].map((h) => (
                <th key={h} style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", padding: "12px 16px", textAlign: "left", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const p = firstOf<any>(a.people) ?? {};
              const c = firstOf<any>(a.companies);
              const camp = firstOf<any>(a.campaigns);
              const sender = firstOf<any>(a.sender_profiles);
              const conn = firstOf<any>(a.connection_status);
              const connState = conn?.state ?? "not_sent";
              const name = p.full_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "—";
              const overlap = a.company_id && (liveByCompany.get(a.company_id) ?? 0) > 1 && LIVE.has(a.status);

              return (
                <tr key={a.id} style={{ backgroundColor: "#303030", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: "#FFFFFF", whiteSpace: "nowrap" }}>
                    {name}
                    {p.linkedin_url && (
                      <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer"
                        style={{ marginLeft: "6px", fontSize: "12px", color: "#A5B4FC", textDecoration: "none" }}>↗</a>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", color: "#BDBDBD", maxWidth: "160px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c?.name ?? "—"}</span>
                      {overlap && (
                        <span title="Istovremeni kontakt iz 2+ profila ka istoj firmi" style={{ color: "#FB923C" }}>⚠</span>
                      )}
                    </div>
                    {c?.domain && <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", fontFamily: "monospace", margin: 0 }}>{c.domain}</p>}
                  </td>
                  <td style={{ padding: "12px 16px", color: "#BDBDBD", maxWidth: "150px" }}>
                    <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>{p.title ?? "—"}</span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#BDBDBD", whiteSpace: "nowrap" }}>{sender?.full_name ?? "—"}</td>
                  <td style={{ padding: "12px 16px", color: "#BDBDBD", whiteSpace: "nowrap" }}>{camp?.name ?? "—"}</td>
                  <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                    <span style={statusBadge(a.status)}>{a.status.replace(/_/g, " ")}</span>
                  </td>
                  <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                    <span style={connBadge(connState)}>{CONN_LABELS[connState] ?? connState}</span>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center", color: "#BDBDBD", whiteSpace: "nowrap" }}>{a.rotation_round}</td>
                  <td style={{ padding: "12px 16px", fontSize: "12px", color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>{fmtDate(a.assigned_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <p style={{ padding: "32px", textAlign: "center", fontSize: "14px", color: "rgba(255,255,255,0.35)" }}>
            Još nema dodela. Pushuj approved leadove iz Review Queue-a da popuniš ledger.
          </p>
        )}
      </div>
    </div>
  );
}
