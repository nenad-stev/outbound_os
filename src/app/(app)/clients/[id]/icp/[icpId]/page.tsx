import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateIcpProfileAction, setIcpDefault } from "@/app/actions/icpProfiles";
import IcpForm from "../IcpForm";
import type { IcpProfile } from "@/lib/types";

export default async function IcpProfileDetailPage({
  params,
}: {
  params: Promise<{ id: string; icpId: string }>;
}) {
  const { id, icpId } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("icp_profiles")
    .select("*")
    .eq("id", icpId)
    .eq("client_id", id)
    .maybeSingle();

  if (!data) notFound();
  const icp = data as IcpProfile;

  const update = updateIcpProfileAction.bind(null, icp.id, id);

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

      <div className="flex items-center justify-between" style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h1 className="text-3xl font-bold text-white">{icp.name}</h1>
          {icp.is_default && (
            <span
              style={{
                backgroundColor: "rgba(255,204,0,0.15)",
                color: "#FFCC00",
                borderRadius: "999px",
                padding: "3px 10px",
                fontSize: "12px",
                fontWeight: 500,
              }}
            >
              default
            </span>
          )}
        </div>
        {!icp.is_default && (
          <form action={setIcpDefault.bind(null, icp.id, id)}>
            <button
              type="submit"
              style={{
                backgroundColor: "transparent",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#FFFFFF",
                borderRadius: "12px",
                padding: "10px 20px",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Set as default
            </button>
          </form>
        )}
      </div>

      <div style={{ maxWidth: "720px" }}>
        <IcpForm action={update} defaults={icp} submitLabel="Save changes" />
      </div>
    </div>
  );
}
