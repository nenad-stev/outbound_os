import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Client, SenderProfile } from "@/lib/types";

export default async function SenderProfilesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: clientData }, { data: profiles }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("sender_profiles")
      .select("*")
      .eq("client_id", id)
      .order("created_at"),
  ]);

  if (!clientData) notFound();
  const client = clientData as Client;
  const senders = (profiles ?? []) as SenderProfile[];

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
        <h1 className="text-3xl font-bold text-white">Sender profiles</h1>
        <Link
          href={`/clients/${id}/profiles/new`}
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
          + Add profile
        </Link>
      </div>

      {senders.length === 0 ? (
        <p style={{ marginTop: "32px", fontSize: "14px", color: "#BDBDBD" }}>
          No sender profiles yet.{" "}
          <Link
            href={`/clients/${id}/profiles/new`}
            style={{ color: "#FFCC00", textDecoration: "underline" }}
          >
            Add the first one.
          </Link>
        </p>
      ) : (
        <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {senders.map((s) => (
            <Link
              key={s.id}
              href={`/clients/${id}/profiles/${s.id}`}
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
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span
                  style={{
                    height: "8px",
                    width: "8px",
                    borderRadius: "50%",
                    backgroundColor: s.is_active ? "#86EFAC" : "rgba(255,255,255,0.2)",
                    flexShrink: 0,
                  }}
                />
                <div>
                  <p style={{ fontSize: "14px", fontWeight: 500, color: "#FFFFFF", marginBottom: "2px" }}>
                    {s.full_name}
                  </p>
                  {s.linkedin_url && (
                    <p style={{ fontSize: "12px", color: "#BDBDBD" }}>{s.linkedin_url}</p>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "12px", color: "#BDBDBD" }}>
                <span>{s.daily_limit} req/day</span>
                {s.heyreach_account_id && (
                  <span style={{ fontFamily: "monospace", color: "rgba(255,255,255,0.35)" }}>
                    HR: {s.heyreach_account_id}
                  </span>
                )}
                <span style={{ color: "rgba(255,255,255,0.35)" }}>→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
