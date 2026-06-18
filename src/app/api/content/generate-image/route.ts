import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const { post_id, client_id, slide_index, custom_prompt } = await req.json();

  if (!post_id || !client_id) {
    return NextResponse.json({ error: "Nedostaju obavezna polja." }, { status: 400 });
  }

  const supabase = await createClient();

  const [{ data: post }, { data: client }] = await Promise.all([
    supabase
      .from("content_posts")
      .select("post_type, image_prompt, slides, topic")
      .eq("id", post_id)
      .maybeSingle(),
    supabase
      .from("clients")
      .select("image_style_guide")
      .eq("id", client_id)
      .maybeSingle(),
  ]);

  if (!post) {
    return NextResponse.json({ error: "Post nije pronađen." }, { status: 404 });
  }

  // Build the prompt
  let basePrompt = "";

  if (post.post_type === "image") {
    basePrompt = post.image_prompt ?? post.topic ?? "Professional LinkedIn image";
  } else if (post.post_type === "carousel") {
    // Use the specific slide or first slide
    let slides = post.slides;
    if (typeof slides === "string") {
      try { slides = JSON.parse(slides); } catch { slides = []; }
    }
    const slide = slides?.[slide_index ?? 0];
    basePrompt = slide
      ? `LinkedIn carousel slide: "${slide.title}". ${slide.body}`
      : post.topic ?? "Professional LinkedIn carousel slide";
  }

  // custom_prompt overrides the auto-generated brief
  const effectivePrompt = (custom_prompt as string | undefined)?.trim() || basePrompt;
  const styleGuide = client?.image_style_guide;
  const fullPrompt = styleGuide
    ? `${effectivePrompt}\n\nBrand style: ${styleGuide}`
    : effectivePrompt;

  let response;
  try {
    response = await openai.images.generate({
    model: "gpt-image-2",
    prompt: `Professional LinkedIn visual. ${fullPrompt}. Clean, modern, business appropriate. No text overlays.`,
    n: 1,
    size: "1024x1024",
    quality: "medium",
  });
  } catch (e: any) {
    const msg = e?.error?.message ?? e?.message ?? "OpenAI greška";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const item = response.data?.[0];
  let imageUrl: string | null = null;

  if (item?.b64_json) {
    imageUrl = `data:image/png;base64,${item.b64_json}`;
  } else if (item?.url) {
    imageUrl = item.url;
  }

  if (!imageUrl) {
    return NextResponse.json({ error: "OpenAI nije vratio sliku." }, { status: 500 });
  }

  // Save to post (base64 data URI — works for display and download)
  await supabase
    .from("content_posts")
    .update({ generated_image_url: imageUrl })
    .eq("id", post_id);

  return NextResponse.json({ image_url: imageUrl });
}
