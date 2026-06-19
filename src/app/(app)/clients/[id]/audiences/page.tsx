import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AudiencesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: clientData }, { data: audiencesData }] = await Promise.all([
    supabase.from("clients").select("id, name").eq("id", id).maybeSingle(),
    supabase
      .from("audiences")
      .select("id, name, source, row_count, created_at, campaigns(name), icp_profiles(name)")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!clientData) notFound();
  const audiences = (audiencesData ?? []) as any[];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#272727", padding: "32px" }}>
      <Link
        href={`/clients/${id}`}
        style={{
          fontSize: "12px",
          color: "rgba(255,255,255,0.4)",
          textDecoration: "none",
          display: "inline-block",
          marginBottom: "12px",
        }}
      >
        ← {clientData.name}
      </Link>

      <div className="flex items-center justify-between" style={{ marginBottom: "8px" }}>
        <h1 className="text-3xl font-bold text-white">Audiences</h1>
        <div className="flex items-center gap-3">
          <Link
            href={`/clients/${id}/audiences/apollo`}
            style={{
              backgroundColor: "transparent",
              color: "#FFCC00",
              fontWeight: 600,
              borderRadius: "12px",
              padding: "10px 20px",
              fontSize: "14px",
              textDecoration: "none",
              display: "inline-block",
              border: "1.5px solid #FFCC00",
            }}
          >
            Apollo Search
          </Link>
          <Link
            href={`/clients/${id}/audiences/new`}
            style={{
              backgroundColor: "#FFCC00",
              color: "#272727",
              fontWeight: 600,
              borderRadius: "12px",
              padding: "10px 20px",
              fontSize: "14px",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            + Import CSV
          </Link>
        </div>
      </div>

      {audiences.length === 0 ? (
        <p style={{ marginTop: "32px", fontSize: "14px", color: "#BDBDBD" }}>
          No audiences yet.{" "}
          <Link
            href={`/clients/${id}/audiences/new`}
            style={{ color: "#FFCC00", textDecoration: "underline" }}
          >
            Import the first one.
          </Link>
        </p>
      ) : (
        <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {audiences.map((a) => (
            <Link
              key={a.id}
              href={`/clients/${id}/audiences/${a.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#303030",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "16px",
                padding: "16px 20px",
                textDecoration: "none",
                transition: "background-color 0.15s",
              }}
              
              
            >
              <div>
                <p style={{ fontSize: "14px", fontWeight: 500, color: "#FFFFFF", marginBottom: "4px" }}>
                  {a.name}
                </p>
                <p style={{ fontSize: "12px", color: "#BDBDBD" }}>
                  {a.row_count} leads
                  {a.campaigns?.name ? ` · ${a.campaigns.name}` : ""}
                  {a.icp_profiles?.name ? ` · ICP: ${a.icp_profiles.name}` : ""}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px", color: "#BDBDBD" }}>
                <span>{new Date(a.created_at).toLocaleDateString("en-US")}</span>
                <span style={{ color: "rgba(255,255,255,0.35)" }}>→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
