import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClientForm from "../ClientForm";
import { updateClientAction, setClientActive } from "@/app/actions/clients";
import type { Client } from "@/lib/types";

const NAV_ITEMS = [
  { label: "ICP profiles", href: (id: string) => `/clients/${id}/icp` },
  { label: "Sender profiles", href: (id: string) => `/clients/${id}/profiles` },
  { label: "Campaigns", href: (id: string) => `/clients/${id}/campaigns` },
  { label: "Audiences", href: (id: string) => `/clients/${id}/audiences` },
  { label: "Review Queue", href: (id: string) => `/clients/${id}/review` },
  { label: "Prospect Ledger", href: (id: string) => `/clients/${id}/ledger` },
  { label: "Rotation Pool", href: (id: string) => `/clients/${id}/rotation` },
  { label: "Follow-up Pool", href: (id: string) => `/clients/${id}/followups` },
  { label: "Content OS", href: (id: string) => `/clients/${id}/content` },
  { label: "Analytics", href: (id: string) => `/clients/${id}/analytics` },
];

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const client = data as Client;

  const update = updateClientAction.bind(null, client.id);
  const toggleActive = setClientActive.bind(null, client.id, !client.is_active);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#272727", padding: "32px" }}>
      <Link
        href="/clients"
        style={{
          fontSize: "12px",
          color: "rgba(255,255,255,0.4)",
          textDecoration: "none",
          display: "inline-block",
          marginBottom: "12px",
        }}
      >
        ← Clients
      </Link>

      <div className="flex items-center justify-between" style={{ marginBottom: "32px" }}>
        <div className="flex items-center" style={{ gap: "12px" }}>
          <h1 className="text-3xl font-bold text-white">{client.name}</h1>
          <span
            style={
              client.is_active
                ? {
                    backgroundColor: "rgba(255,204,0,0.15)",
                    color: "#FFCC00",
                    borderRadius: "999px",
                    padding: "3px 10px",
                    fontSize: "12px",
                    fontWeight: 500,
                  }
                : {
                    backgroundColor: "rgba(255,255,255,0.08)",
                    color: "#BDBDBD",
                    borderRadius: "999px",
                    padding: "3px 10px",
                    fontSize: "12px",
                    fontWeight: 500,
                  }
            }
          >
            {client.is_active ? "Active" : "Inactive"}
          </span>
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "32px",
        }}
      >
        <section>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.35)",
              marginBottom: "16px",
            }}
          >
            Details
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

        <section>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.35)",
              marginBottom: "16px",
            }}
          >
            Configuration
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href(client.id)}
                className="link-card"
              >
                <span>{item.label}</span>
                <span style={{ color: "rgba(255,255,255,0.35)" }}>→</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
