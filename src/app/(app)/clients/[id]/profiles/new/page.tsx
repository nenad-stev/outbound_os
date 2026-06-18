import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createSenderProfileAction } from "@/app/actions/senderProfiles";
import SenderProfileForm from "../SenderProfileForm";
import type { Client } from "@/lib/types";

export default async function NewSenderProfilePage({
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

  const action = createSenderProfileAction.bind(null, client.id);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#272727", padding: "32px" }}>
      <Link
        href={`/clients/${id}/profiles`}
        style={{
          fontSize: "12px",
          color: "rgba(255,255,255,0.4)",
          textDecoration: "none",
          display: "inline-block",
          marginBottom: "12px",
        }}
      >
        ← Sender profiles
      </Link>
      <h1 className="text-3xl font-bold text-white" style={{ marginBottom: "4px" }}>
        Add sender profile
      </h1>
      <p style={{ fontSize: "14px", color: "#BDBDBD", marginBottom: "32px" }}>
        LinkedIn account that sends outreach for{" "}
        <span style={{ color: "#FFFFFF", fontWeight: 500 }}>{client.name}</span>.
      </p>

      <div style={{ maxWidth: "480px" }}>
        <SenderProfileForm action={action} submitLabel="Add profile" />
      </div>
    </div>
  );
}
