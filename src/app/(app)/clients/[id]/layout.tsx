import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ClientTabs from "./ClientTabs";

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", id)
    .maybeSingle();

  return (
    <div>
      {/* Sticky client sub-nav */}
      <div
        style={{
          position: "sticky",
          top: "-32px",
          zIndex: 10,
          backgroundColor: "#272727",
          margin: "-32px -32px 24px",
          padding: "16px 32px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center" style={{ gap: "8px", marginBottom: "12px", fontSize: "12px" }}>
          <Link href="/clients" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>
            Clients
          </Link>
          <span style={{ color: "rgba(255,255,255,0.25)" }}>/</span>
          <Link href={`/clients/${id}`} style={{ color: "#FFFFFF", textDecoration: "none", fontWeight: 600 }}>
            {client?.name ?? "Client"}
          </Link>
        </div>
        <ClientTabs clientId={id} />
      </div>

      {children}
    </div>
  );
}
