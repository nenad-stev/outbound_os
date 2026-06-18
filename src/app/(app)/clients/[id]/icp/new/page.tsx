import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createIcpProfileAction } from "@/app/actions/icpProfiles";
import IcpForm from "../IcpForm";
import type { Client } from "@/lib/types";

export default async function NewIcpProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const client = data as Client;

  const action = createIcpProfileAction.bind(null, client.id);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#272727", padding: "32px" }}>
      <Link
        href={`/clients/${id}/icp`}
        style={{
          fontSize: "12px",
          color: "rgba(255,255,255,0.4)",
          textDecoration: "none",
          display: "inline-block",
          marginBottom: "12px",
        }}
      >
        ← ICP profiles
      </Link>
      <h1 className="text-3xl font-bold text-white" style={{ marginBottom: "4px" }}>
        New ICP profile
      </h1>
      <p style={{ fontSize: "14px", color: "#BDBDBD", marginBottom: "32px" }}>
        For client <span style={{ color: "#FFFFFF", fontWeight: 500 }}>{client.name}</span>.
      </p>
      <div style={{ maxWidth: "720px" }}>
        <IcpForm action={action} submitLabel="Create ICP" />
      </div>
    </div>
  );
}
