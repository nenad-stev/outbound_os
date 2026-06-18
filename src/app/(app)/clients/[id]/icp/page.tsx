import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setIcpDefault } from "@/app/actions/icpProfiles";
import type { Client, IcpProfile } from "@/lib/types";

export default async function IcpProfilesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: clientData }, { data: profiles }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase.from("icp_profiles").select("*").eq("client_id", id).order("created_at"),
  ]);

  if (!clientData) notFound();
  const client = clientData as Client;
  const icps = (profiles ?? []) as IcpProfile[];

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
        ← {client.name}
      </Link>

      <div className="flex items-center justify-between" style={{ marginBottom: "8px" }}>
        <h1 className="text-3xl font-bold text-white">ICP profiles</h1>
        <Link
          href={`/clients/${id}/icp/new`}
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
          + Add ICP
        </Link>
      </div>

      {icps.length === 0 ? (
        <p style={{ marginTop: "32px", fontSize: "14px", color: "#BDBDBD" }}>
          No ICP profiles yet.{" "}
          <Link href={`/clients/${id}/icp/new`} style={{ color: "#FFCC00", textDecoration: "underline" }}>
            Add the first one.
          </Link>
        </p>
      ) : (
        <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {icps.map((icp) => (
            <div
              key={icp.id}
              style={{
                backgroundColor: "#303030",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "16px",
                padding: "20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <Link
                      href={`/clients/${id}/icp/${icp.id}`}
                      style={{ fontSize: "14px", fontWeight: 500, color: "#FFFFFF", textDecoration: "none" }}
                    >
                      {icp.name}
                    </Link>
                    {icp.is_default && (
                      <span
                        style={{
                          backgroundColor: "rgba(255,204,0,0.15)",
                          color: "#FFCC00",
                          borderRadius: "999px",
                          padding: "2px 8px",
                          fontSize: "11px",
                          fontWeight: 500,
                        }}
                      >
                        default
                      </span>
                    )}
                  </div>
                  {icp.target_description && (
                    <p
                      style={{
                        fontSize: "13px",
                        color: "#BDBDBD",
                        marginBottom: "8px",
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {icp.target_description}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: "12px", fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
                    <span>ICP {icp.weight_overrides.icp_fit}</span>
                    <span>Signal {icp.weight_overrides.signal}</span>
                    <span>Engagement {icp.weight_overrides.engagement}</span>
                    {icp.target_roles.length > 0 && (
                      <span>{icp.target_roles.length} roles</span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {!icp.is_default && (
                    <form action={setIcpDefault.bind(null, icp.id, id)}>
                      <button
                        type="submit"
                        style={{
                          backgroundColor: "transparent",
                          border: "none",
                          color: "rgba(255,255,255,0.35)",
                          fontSize: "12px",
                          cursor: "pointer",
                          textDecoration: "underline",
                          padding: 0,
                        }}
                      >
                        Set default
                      </button>
                    </form>
                  )}
                  <Link
                    href={`/clients/${id}/icp/${icp.id}`}
                    style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none", fontSize: "16px" }}
                  >
                    →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
