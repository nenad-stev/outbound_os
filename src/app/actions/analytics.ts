"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

export async function savePostAnalytics(fd: FormData) {
  await requireUser();
  const supabase = await createClient();

  const postId    = fd.get("post_id")    as string;
  const clientId  = fd.get("client_id")  as string;
  const impressions = parseInt(fd.get("impressions") as string) || 0;
  const likes       = parseInt(fd.get("likes")       as string) || 0;
  const comments    = parseInt(fd.get("comments")    as string) || 0;
  const shares      = parseInt(fd.get("shares")      as string) || 0;

  const { error } = await supabase
    .from("content_posts")
    .update({ impressions, likes, comments, shares, analytics_updated_at: new Date().toISOString() })
    .eq("id", postId)
    .eq("client_id", clientId);

  if (error) throw new Error(error.message);
}
