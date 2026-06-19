import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ audienceId: string }> }
) {
  const { audienceId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("audience_members")
    .select("qualify_status")
    .eq("audience_id", audienceId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const total = rows.length;
  const pending = rows.filter((r) => r.qualify_status === "pending").length;
  const qualified = rows.filter((r) => r.qualify_status === "qualified").length;
  const disqualified = rows.filter((r) => r.qualify_status === "disqualified").length;
  const noData = rows.filter((r) => r.qualify_status === "not_able_to_qualify").length;
  const processed = total - pending;

  return NextResponse.json({ total, pending, processed, qualified, disqualified, noData });
}
