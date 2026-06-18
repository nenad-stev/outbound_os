import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

function first<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function pct(num: number, den: number) {
  if (!den) return "—";
  return `${Math.round((num / den) * 100)}%`;
}

const POST_STATUS_COLOR: Record<string, React.CSSProperties> = {
  draft:     { backgroundColor: "rgba(255,255,255,0.08)", color: "#BDBDBD" },
  approved:  { backgroundColor: "rgba(255,204,0,0.15)", color: "#FFCC00" },
  published: { backgroundColor: "rgba(134,239,172,0.12)", color: "#86EFAC" },
  archived:  { backgroundColor: "rgba(239,68,68,0.08)", color: "#F87171" },
};

function KpiBar({ label, value, total }: { label: string; value: number; total: number }) {
  const ratio = total > 0 ? value / total : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontSize: "12px", color: "#BDBDBD" }}>{label}</span>
        <span style={{ fontSize: "12px", fontWeight: 600, color: "#FFFFFF" }}>
          {value} <span style={{ color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>/ {total}</span>
        </span>
      </div>
      <div style={{ height: "4px", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "2px" }}>
        <div style={{ height: "4px", width: `${Math.round(ratio * 100)}%`, backgroundColor: "#FFCC00", borderRadius: "2px", transition: "width 0.3s ease" }} />
      </div>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  await requireUser();
  const { client: clientParam } = await searchParams;
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, is_active")
    .order("name");

  const clientList = (clients ?? []) as any[];

  const defaultClient =
    clientList.find((c) => c.name.toLowerCase().includes("lead agent")) ??
    clientList[0];
  const selectedClientId = clientParam ?? defaultClient?.id ?? null;
  const selectedClient = clientList.find((c) => c.id === selectedClientId) ?? defaultClient;

  if (!selectedClientId) {
    return (
      <div style={{ padding: "64px 0", textAlign: "center" }}>
        <p style={{ color: "#BDBDBD" }}>
          Nema klijenata.{" "}
          <Link href="/clients/new" style={{ color: "#FFCC00", textDecoration: "none" }}>
            Dodaj prvog →
          </Link>
        </p>
      </div>
    );
  }

  const [
    { data: profiles },
    { data: assignments },
    { data: contentPosts },
    { data: rotationPool },
    { data: followupPool },
  ] = await Promise.all([
    supabase
      .from("sender_profiles")
      .select("id, full_name, linkedin_url, daily_limit")
      .eq("client_id", selectedClientId)
      .order("full_name"),
    supabase
      .from("lead_assignments")
      .select("id, status, sender_profile_id, connection_status(state)")
      .eq("client_id", selectedClientId),
    supabase
      .from("content_posts")
      .select("id, status, sender_profile_id, post_type")
      .eq("client_id", selectedClientId),
    supabase.from("rotation_pool").select("id, status").eq("client_id", selectedClientId),
    supabase.from("followup_pool").select("id, status").eq("client_id", selectedClientId),
  ]);

  const profileList = (profiles ?? []) as any[];
  const assignmentList = (assignments ?? []) as any[];
  const postList = (contentPosts ?? []) as any[];
  const rotList = (rotationPool ?? []) as any[];
  const fupList = (followupPool ?? []) as any[];

  type ProfileStats = {
    pushed: number; connected: number; replied: number;
    posts: { draft: number; approved: number; published: number; archived: number; total: number };
  };

  const statsMap = new Map<string, ProfileStats>();
  for (const p of profileList) {
    statsMap.set(p.id, { pushed: 0, connected: 0, replied: 0, posts: { draft: 0, approved: 0, published: 0, archived: 0, total: 0 } });
  }

  for (const a of assignmentList) {
    const s = statsMap.get(a.sender_profile_id);
    if (!s) continue;
    s.pushed++;
    const cs = first<any>(a.connection_status);
    if (cs?.state === "accepted" || a.status === "replied") s.connected++;
    if (a.status === "replied") s.replied++;
  }

  for (const p of postList) {
    const s = statsMap.get(p.sender_profile_id);
    if (!s) continue;
    s.posts.total++;
    if (p.status in s.posts) (s.posts as any)[p.status]++;
  }

  const totals = {
    pushed: assignmentList.length,
    connected: [...statsMap.values()].reduce((a, s) => a + s.connected, 0),
    replied: [...statsMap.values()].reduce((a, s) => a + s.replied, 0),
    posts: postList.length,
    published: postList.filter((p) => p.status === "published").length,
  };

  const pendingRotation = rotList.filter((r) => r.status === "pending").length;
  const pendingFollowup = fupList.filter((r) => r.status === "pending").length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#FFFFFF", margin: 0 }}>Dashboard</h1>
          <p style={{ fontSize: "13px", color: "#BDBDBD", marginTop: "4px" }}>
            Performance po identitetu — {selectedClient?.name}
          </p>
        </div>
        <Link
          href={`/clients/${selectedClientId}`}
          style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", textDecoration: "none", marginTop: "4px" }}
        >
          Otvori klijenta →
        </Link>
      </div>

      {/* Client switcher */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "32px" }}>
        {clientList.map((c) => (
          <Link
            key={c.id}
            href={`/?client=${c.id}`}
            style={c.id === selectedClientId
              ? { backgroundColor: "#FFCC00", color: "#272727", fontWeight: 700, borderRadius: "10px", padding: "6px 16px", fontSize: "13px", textDecoration: "none" }
              : { backgroundColor: "rgba(255,255,255,0.06)", color: "#BDBDBD", borderRadius: "10px", padding: "6px 16px", fontSize: "13px", textDecoration: "none" }
            }
          >
            {c.name}
          </Link>
        ))}
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "16px", marginBottom: "28px" }}>
        {[
          { label: "Pushano", value: totals.pushed, rate: null },
          { label: "Konekcija", value: totals.connected, rate: pct(totals.connected, totals.pushed) },
          { label: "Odgovora", value: totals.replied, rate: pct(totals.replied, totals.connected) },
          { label: "Postova", value: totals.posts, rate: null },
          { label: "Objavljeno", value: totals.published, rate: pct(totals.published, totals.posts) },
        ].map((kpi) => (
          <div key={kpi.label} style={{ backgroundColor: "#303030", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "20px 24px" }}>
            <div style={{ fontSize: "34px", fontWeight: 700, color: "#FFFFFF", lineHeight: 1 }}>{kpi.value}</div>
            {kpi.rate && <div style={{ fontSize: "13px", fontWeight: 600, color: "#FFCC00", marginTop: "4px" }}>{kpi.rate}</div>}
            <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", marginTop: "8px" }}>
              {kpi.label}
            </div>
          </div>
        ))}
      </div>

      {/* Alert row */}
      {(pendingRotation > 0 || pendingFollowup > 0) && (
        <div style={{ display: "flex", gap: "12px", marginBottom: "32px" }}>
          {pendingRotation > 0 && (
            <Link href={`/clients/${selectedClientId}/rotation`} style={{ flex: 1, display: "flex", alignItems: "center", gap: "12px", backgroundColor: "rgba(255,204,0,0.06)", border: "1px solid rgba(255,204,0,0.2)", borderRadius: "12px", padding: "14px 18px", textDecoration: "none" }}>
              <span style={{ fontSize: "22px", fontWeight: 700, color: "#FFCC00" }}>{pendingRotation}</span>
              <span style={{ fontSize: "13px", color: "#BDBDBD" }}>leadova čeka rotation →</span>
            </Link>
          )}
          {pendingFollowup > 0 && (
            <Link href={`/clients/${selectedClientId}/followups`} style={{ flex: 1, display: "flex", alignItems: "center", gap: "12px", backgroundColor: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "12px", padding: "14px 18px", textDecoration: "none" }}>
              <span style={{ fontSize: "22px", fontWeight: 700, color: "#A5B4FC" }}>{pendingFollowup}</span>
              <span style={{ fontSize: "13px", color: "#BDBDBD" }}>čeka follow-up →</span>
            </Link>
          )}
        </div>
      )}

      {/* Identity cards */}
      <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", marginBottom: "16px" }}>
        Identiteti
      </p>

      {profileList.length === 0 ? (
        <div style={{ backgroundColor: "#303030", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "40px", textAlign: "center" }}>
          <p style={{ color: "#BDBDBD", fontSize: "14px" }}>
            Nema sender profila.{" "}
            <Link href={`/clients/${selectedClientId}/profiles/new`} style={{ color: "#FFCC00", textDecoration: "none" }}>
              Dodaj identitet →
            </Link>
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "16px", marginBottom: "40px" }}>
          {profileList.map((profile) => {
            const s = statsMap.get(profile.id)!;
            return (
              <div key={profile.id} style={{ backgroundColor: "#303030", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "24px" }}>
                {/* Profile header */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                  <div style={{ width: "42px", height: "42px", borderRadius: "12px", backgroundColor: "#1E1E1E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", fontWeight: 700, color: "#FFCC00", flexShrink: 0 }}>
                    {profile.full_name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "15px", fontWeight: 600, color: "#FFFFFF", margin: 0 }}>{profile.full_name}</p>
                    {profile.linkedin_url && (
                      <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>
                        LinkedIn ↗
                      </a>
                    )}
                  </div>
                  <Link
                    href={`/clients/${selectedClientId}/content/new`}
                    style={{ backgroundColor: "#FFCC00", color: "#272727", fontWeight: 600, borderRadius: "8px", padding: "6px 12px", fontSize: "12px", textDecoration: "none", whiteSpace: "nowrap" }}
                  >
                    + Post
                  </Link>
                </div>

                {/* Outreach */}
                <div style={{ marginBottom: "20px" }}>
                  <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", marginBottom: "12px" }}>
                    Outreach
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <KpiBar label="Pushano" value={s.pushed} total={s.pushed || 1} />
                    <KpiBar label="Konekcija" value={s.connected} total={s.pushed || 1} />
                    <KpiBar label="Odgovora" value={s.replied} total={s.connected || 1} />
                  </div>
                  <div style={{ display: "flex", gap: "12px", marginTop: "10px" }}>
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                      CR: <span style={{ color: "#FFFFFF", fontWeight: 600 }}>{pct(s.connected, s.pushed)}</span>
                    </span>
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                      RR: <span style={{ color: "#FFFFFF", fontWeight: 600 }}>{pct(s.replied, s.connected)}</span>
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px" }}>
                  <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", marginBottom: "12px" }}>
                    Content
                  </p>
                  {s.posts.total === 0 ? (
                    <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>Nema postova još.</p>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {(["published", "approved", "draft", "archived"] as const).map((st) =>
                        (s.posts as any)[st] > 0 ? (
                          <span key={st} style={{ borderRadius: "999px", padding: "3px 10px", fontSize: "11px", fontWeight: 500, ...(POST_STATUS_COLOR[st] ?? {}) }}>
                            {(s.posts as any)[st]} {st}
                          </span>
                        ) : null
                      )}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "12px", marginTop: "10px" }}>
                    <Link href={`/clients/${selectedClientId}/content?profile=${profile.id}`} style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>
                      Biblioteka →
                    </Link>
                    <Link href={`/clients/${selectedClientId}/content/strategy`} style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>
                      Strategija →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick actions */}
      <p style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", marginBottom: "12px" }}>
        Brze akcije
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {[
          { label: "Review Queue", href: `/clients/${selectedClientId}/review` },
          { label: "Prospect Ledger", href: `/clients/${selectedClientId}/ledger` },
          { label: "Audiences", href: `/clients/${selectedClientId}/audiences` },
          { label: "Campaigns", href: `/clients/${selectedClientId}/campaigns` },
          { label: "Novi post", href: `/clients/${selectedClientId}/content/new` },
          { label: "Rotation Pool", href: `/clients/${selectedClientId}/rotation` },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#BDBDBD", borderRadius: "10px", padding: "8px 16px", fontSize: "13px", textDecoration: "none" }}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
