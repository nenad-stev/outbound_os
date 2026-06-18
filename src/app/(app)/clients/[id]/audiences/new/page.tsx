import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { uploadAudienceAction } from "@/app/actions/audiences";
import AudienceUploadForm from "./AudienceUploadForm";

export default async function NewAudiencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: clientData }, { data: campaignsData }, { data: icpData }] = await Promise.all([
    supabase.from("clients").select("id, name").eq("id", id).maybeSingle(),
    supabase
      .from("campaigns")
      .select("id, name, type, sender_profile_id, sender_profiles(full_name)")
      .eq("client_id", id)
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
    supabase
      .from("icp_profiles")
      .select("id, name, is_default")
      .eq("client_id", id)
      .order("created_at"),
  ]);

  if (!clientData) notFound();

  const campaigns = ((campaignsData ?? []) as any[]).map((c) => ({
    id: c.id,
    name: c.name,
    sender_name: (c.sender_profiles as any)?.full_name ?? null,
  }));

  const icpProfiles = (icpData ?? []) as { id: string; name: string; is_default: boolean }[];
  const action = uploadAudienceAction.bind(null, id);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#272727", padding: "32px" }}>
      <Link
        href={`/clients/${id}/audiences`}
        style={{
          fontSize: "12px",
          color: "rgba(255,255,255,0.4)",
          textDecoration: "none",
          display: "inline-block",
          marginBottom: "12px",
        }}
      >
        ← Audiences
      </Link>
      <h1 className="text-3xl font-bold text-white" style={{ marginBottom: "4px" }}>
        Import audience
      </h1>
      <p style={{ fontSize: "14px", color: "#BDBDBD", marginBottom: "32px" }}>
        For client{" "}
        <span style={{ color: "#FFFFFF", fontWeight: 500 }}>{clientData.name}</span>.{" "}
        Supported formats: Apollo export, Sales Navigator via LGM.
      </p>

      <div style={{ maxWidth: "520px" }}>
        <AudienceUploadForm
          campaigns={campaigns}
          icpProfiles={icpProfiles}
          action={action}
        />
      </div>
    </div>
  );
}
