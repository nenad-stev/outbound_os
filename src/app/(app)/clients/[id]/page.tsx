import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClientForm from "../ClientForm";
import { updateClientAction, setClientActive } from "@/app/actions/clients";
import type { Client } from "@/lib/types";

type CountKey =
  | "icp" | "senders" | "campaigns" | "audiences"
  | "content" | "ledger";

interface NavItem {
  label: string;
  desc: string;
  href: (id: string) => string;
  icon: string; // inline SVG path data
  count?: CountKey;
}

interface NavGroup {
  label: string;
  accent: string;
  items: NavItem[];
}

// Lucide-style 24x24 stroke icons (path data only)
const ICONS: Record<string, string> = {
  target: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  user: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  send: "m22 2-7 20-4-9-9-4ZM22 2 11 13",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  check: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z",
  rotate: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M3 21v-5h5",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2",
  edit: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z",
  chart: "M3 3v18h18M18 17V9M13 17V5M8 17v-3",
};

const GROUPS: NavGroup[] = [
  {
    label: "Setup",
    accent: "#9CA3AF",
    items: [
      { label: "ICP profiles", desc: "Ko je idealan kupac", href: (id) => `/clients/${id}/icp`, icon: "target", count: "icp" },
      { label: "Sender profiles", desc: "LinkedIn nalozi koji šalju", href: (id) => `/clients/${id}/profiles`, icon: "user", count: "senders" },
    ],
  },
  {
    label: "Audience",
    accent: "#60A5FA",
    items: [
      { label: "Audiences", desc: "Import i Apollo search", href: (id) => `/clients/${id}/audiences`, icon: "users", count: "audiences" },
      { label: "Review Queue", desc: "Odobri kvalifikovane leadove", href: (id) => `/clients/${id}/review`, icon: "check" },
    ],
  },
  {
    label: "Outreach",
    accent: "#FFCC00",
    items: [
      { label: "Campaigns", desc: "Kampanje i sekvence", href: (id) => `/clients/${id}/campaigns`, icon: "send", count: "campaigns" },
      { label: "Prospect Ledger", desc: "Svi leadovi i status", href: (id) => `/clients/${id}/ledger`, icon: "book", count: "ledger" },
      { label: "Rotation Pool", desc: "Ko je na redu za outreach", href: (id) => `/clients/${id}/rotation`, icon: "rotate" },
      { label: "Follow-up Pool", desc: "Zakazani follow-up-ovi", href: (id) => `/clients/${id}/followups`, icon: "clock" },
    ],
  },
  {
    label: "Content",
    accent: "#A78BFA",
    items: [
      { label: "Content OS", desc: "Generiši i objavi postove", href: (id) => `/clients/${id}/content`, icon: "edit", count: "content" },
    ],
  },
  {
    label: "Analytics",
    accent: "#34D399",
    items: [
      { label: "Analytics", desc: "Impresije, engagement, trend", href: (id) => `/clients/${id}/analytics`, icon: "chart" },
    ],
  },
];

function Icon({ name, color }: { name: string; color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name]} />
    </svg>
  );
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const cnt = (table: string) =>
    supabase.from(table).select("id", { count: "exact", head: true }).eq("client_id", id);

  const [
    { data },
    icpC, sendersC, campaignsC, audiencesC, contentC, ledgerC,
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    cnt("icp_profiles"),
    cnt("sender_profiles"),
    cnt("campaigns"),
    cnt("audiences"),
    cnt("content_posts"),
    cnt("lead_assignments"),
  ]);

  if (!data) notFound();
  const client = data as Client;

  const counts: Record<CountKey, number | null> = {
    icp: icpC.count ?? null,
    senders: sendersC.count ?? null,
    campaigns: campaignsC.count ?? null,
    audiences: audiencesC.count ?? null,
    content: contentC.count ?? null,
    ledger: ledgerC.count ?? null,
  };

  const update = updateClientAction.bind(null, client.id);
  const toggleActive = setClientActive.bind(null, client.id, !client.is_active);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: "28px" }}>
        <div className="flex items-center" style={{ gap: "12px" }}>
          <h1 className="text-3xl font-bold text-white">{client.name}</h1>
          <span
            style={{
              backgroundColor: client.is_active ? "rgba(255,204,0,0.15)" : "rgba(255,255,255,0.08)",
              color: client.is_active ? "#FFCC00" : "#BDBDBD",
              borderRadius: "999px",
              padding: "3px 10px",
              fontSize: "12px",
              fontWeight: 500,
            }}
          >
            {client.is_active ? "Active" : "Inactive"}
          </span>
          {client.website && (
            <a
              href={client.website.startsWith("http") ? client.website : `https://${client.website}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", textDecoration: "none" }}
            >
              {client.website.replace(/^https?:\/\//, "")} ↗
            </a>
          )}
        </div>
        <form action={toggleActive}>
          <button
            type="submit"
            style={{
              backgroundColor: "transparent",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.4)",
              borderRadius: "12px",
              padding: "10px 20px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            {client.is_active ? "Deactivate" : "Activate"}
          </button>
        </form>
      </div>

      {/* Category groups */}
      <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
        {GROUPS.map((group) => (
          <section key={group.label}>
            <div className="flex items-center" style={{ gap: "8px", marginBottom: "12px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "999px", backgroundColor: group.accent }} />
              <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.10em", color: "rgba(255,255,255,0.5)" }}>
                {group.label}
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "12px" }}>
              {group.items.map((item) => {
                const count = item.count ? counts[item.count] : null;
                return (
                  <Link key={item.label} href={item.href(client.id)} className="cat-card">
                    <div className="flex items-center justify-between" style={{ marginBottom: "10px" }}>
                      <span
                        className="flex items-center justify-center"
                        style={{ width: "34px", height: "34px", borderRadius: "9px", backgroundColor: "rgba(255,255,255,0.05)" }}
                      >
                        <Icon name={item.icon} color={group.accent} />
                      </span>
                      {count !== null && (
                        <span style={{ fontSize: "18px", fontWeight: 700, color: "#FFFFFF" }}>{count}</span>
                      )}
                    </div>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: "#FFFFFF", marginBottom: "2px" }}>{item.label}</p>
                    <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>{item.desc}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Settings (collapsible-ish at bottom) */}
      <section style={{ marginTop: "40px", maxWidth: "560px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.10em", color: "rgba(255,255,255,0.5)", marginBottom: "16px" }}>
          Podešavanja klijenta
        </p>
        <ClientForm
          action={update}
          defaults={{
            name: client.name,
            website: client.website,
            notes: client.notes,
            image_style_guide: (client as any).image_style_guide,
          }}
          submitLabel="Save changes"
        />
      </section>
    </div>
  );
}
