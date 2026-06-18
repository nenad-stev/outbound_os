import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  const clients = (data ?? []) as Client[];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#272727", padding: "32px" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: "8px" }}>
        <h1 className="text-3xl font-bold text-white">Clients</h1>
        <Link
          href="/clients/new"
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
          + New client
        </Link>
      </div>

      {error && (
        <p style={{ marginTop: "24px", fontSize: "14px", color: "#F87171" }}>
          Could not load clients: {error.message}
        </p>
      )}

      {!error && clients.length === 0 && (
        <p style={{ marginTop: "24px", fontSize: "14px", color: "#BDBDBD" }}>
          No clients yet. Create your first one.
        </p>
      )}

      {clients.length > 0 && (
        <div
          style={{
            marginTop: "24px",
            borderRadius: "16px",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#1E1E1E" }}>
                {["Name", "Website", "Status"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "11px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "rgba(255,255,255,0.35)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map((c, i) => (
                <tr
                  key={c.id}
                  style={{
                    backgroundColor: "#303030",
                    borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none",
                    transition: "background-color 0.15s",
                  }}
                  
                  
                >
                  <td style={{ padding: "14px 16px" }}>
                    <Link
                      href={`/clients/${c.id}`}
                      style={{
                        color: "#FFFFFF",
                        fontWeight: 500,
                        fontSize: "14px",
                        textDecoration: "none",
                      }}
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: "14px", color: "#BDBDBD" }}>
                    {c.website ?? "—"}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span
                      style={
                        c.is_active
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
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
