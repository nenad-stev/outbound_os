import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// n8n-facing endpoints for the scheduled LinkedIn publishing flow.
// Both require the shared SYNC_SECRET (no browser session). The proxy lets
// /api/content/ through when x-sync-secret matches.

function authed(req: NextRequest): boolean {
  const secret = req.headers.get("x-sync-secret");
  return Boolean(secret && secret === process.env.SYNC_SECRET);
}

// GET → n8n checks (right before posting) that the post is still scheduled and
// pulls the latest content. Lets a cancelled/edited post be skipped or refreshed.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { postId } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("content_posts")
    .select("id, status, content, scheduled_at, sender_profiles(full_name, linkedin_url)")
    .eq("id", postId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const profile = Array.isArray((data as any).sender_profiles)
    ? (data as any).sender_profiles[0]
    : (data as any).sender_profiles;

  return NextResponse.json({
    post_id: data.id,
    status: data.status,
    should_publish: data.status === "scheduled",
    content: data.content,
    scheduled_at: data.scheduled_at,
    full_name: profile?.full_name ?? null,
    linkedin_url: profile?.linkedin_url ?? null,
  });
}

// POST → n8n reports the post went out. Marks it published + stores the URL.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { postId } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    linkedin_post_url?: string;
    error?: string;
  };

  const supabase = createAdminClient();

  // n8n reported a failure → leave it back as approved so it can be retried.
  if (body.error) {
    await supabase
      .from("content_posts")
      .update({ status: "approved", scheduled_at: null })
      .eq("id", postId)
      .eq("status", "scheduled");
    return NextResponse.json({ ok: true, marked: "failed" });
  }

  const { error } = await supabase
    .from("content_posts")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      scheduled_at: null,
      linkedin_post_url: body.linkedin_post_url ?? null,
    })
    .eq("id", postId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, marked: "published" });
}
