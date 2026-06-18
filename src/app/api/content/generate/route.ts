import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

type PostType = "text" | "image" | "carousel";
type PostMode = "pillar" | "inspiration" | "adhoc";

interface GenerateRequest {
  mode: PostMode;
  post_type: PostType;
  sender_profile_id: string;
  client_id: string;
  topic?: string;
  pillar_id?: string;
  inspiration_texts?: string[];
}

function buildPrompt(
  mode: PostMode,
  post_type: PostType,
  strategy: any,
  pillar: any,
  topic: string | undefined,
  inspiration_texts: string[]
): string {
  const strategyBlock = strategy
    ? `
## Sender context
- About: ${strategy.about_me ?? "—"}
- Tone & voice: ${strategy.tone_voice ?? "—"}
- Target audience: ${strategy.target_audience ?? "—"}
- Posting frequency: ${strategy.posting_frequency ?? "—"}
${strategy.extra_rules ? `- Extra rules: ${strategy.extra_rules}` : ""}`.trim()
    : "";

  const pillarBlock =
    pillar
      ? `\n## Content pillar\n- Name: ${pillar.name}\n- Description: ${pillar.description ?? "—"}\n- Example topics: ${(pillar.example_topics ?? []).join(", ") || "—"}`
      : "";

  let modeInstruction = "";
  if (mode === "pillar") {
    modeInstruction = `Write a LinkedIn post for the pillar above${topic ? ` on this specific angle: "${topic}"` : ""}. Choose a concrete, specific topic from the pillar's example topics or invent one that fits well.`;
  } else if (mode === "inspiration") {
    modeInstruction = `Below are ${inspiration_texts.length} LinkedIn posts that performed well in this niche. Study their structure, hooks, and angles — then write a completely original post in the sender's voice that covers similar themes WITHOUT copying phrasing.\n\n${inspiration_texts.map((t, i) => `### Inspiration post ${i + 1}\n${t}`).join("\n\n")}`;
  } else {
    modeInstruction = `Write a LinkedIn post on this topic: "${topic ?? "unspecified topic"}".`;
  }

  let formatInstruction = "";
  if (post_type === "text") {
    formatInstruction = `
## Format: text post
Output a ready-to-publish LinkedIn text post (no markdown formatting — no bold, no headers). Use line breaks for rhythm. Aim for 150–300 words. End with a question or call to action.

Return ONLY the post text — no preamble, no explanation.`;
  } else if (post_type === "image") {
    formatInstruction = `
## Format: image post
Output two parts separated by ---IMAGE_PROMPT---:
1. The LinkedIn caption (150–250 words, engaging, ends with a question or CTA)
2. A visual brief for the accompanying image (2–3 sentences describing the scene, style, and mood for a designer or AI image tool)

Example format:
<caption text here>
---IMAGE_PROMPT---
<image brief here>`;
  } else {
    formatInstruction = `
## Format: carousel post
Output a LinkedIn carousel with 4–7 slides as JSON — no other text.

Schema (array of slides):
[
  { "title": "Slide 1 title", "body": "2-4 short lines of text", "cta": "optional CTA on last slide" },
  ...
]

Rules:
- Slide 1: strong hook / problem statement
- Slides 2–N-1: insight, framework, or steps
- Last slide: takeaway + CTA
- Keep body under 40 words per slide
- Return ONLY valid JSON array`;
  }

  return `You are a professional LinkedIn ghostwriter. Write content that sounds authentic and human — not corporate or AI-generated.

${strategyBlock}
${pillarBlock}

## Task
${modeInstruction}
${formatInstruction}`;
}

export async function POST(req: NextRequest) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const body: GenerateRequest = await req.json();
  const { mode, post_type, sender_profile_id, client_id, topic, pillar_id, inspiration_texts = [] } = body;

  if (!mode || !post_type || !sender_profile_id || !client_id) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const supabase = await createClient();

  // Fetch strategy (+ pillar if provided)
  const [{ data: strategyData }, { data: pillarData }] = await Promise.all([
    supabase
      .from("content_strategies")
      .select("*")
      .eq("sender_profile_id", sender_profile_id)
      .maybeSingle(),
    pillar_id
      ? supabase.from("content_pillars").select("*").eq("id", pillar_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const prompt = buildPrompt(mode, post_type, strategyData, pillarData, topic, inspiration_texts);

  // Call Claude with adaptive thinking + streaming
  const stream = await anthropic.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
  });

  const message = await stream.finalMessage();

  // Extract text content from the response
  let rawContent = "";
  for (const block of message.content) {
    if (block.type === "text") rawContent = block.text;
  }

  // Parse output per post_type
  let content: string | null = null;
  let slides: unknown = null;
  let image_prompt: string | null = null;

  if (post_type === "carousel") {
    // Strip code fences if present
    const jsonStr = rawContent.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    try {
      slides = JSON.parse(jsonStr);
    } catch {
      slides = null;
      content = rawContent; // fallback: store as raw text
    }
  } else if (post_type === "image") {
    const sep = rawContent.indexOf("---IMAGE_PROMPT---");
    if (sep !== -1) {
      content = rawContent.slice(0, sep).trim();
      image_prompt = rawContent.slice(sep + "---IMAGE_PROMPT---".length).trim();
    } else {
      content = rawContent;
    }
  } else {
    content = rawContent;
  }

  // Insert the post
  const { data: post, error } = await supabase
    .from("content_posts")
    .insert({
      sender_profile_id,
      client_id,
      pillar_id: pillar_id ?? null,
      post_type,
      status: "draft",
      source: mode,
      topic: topic ?? null,
      content,
      slides: slides ?? null,
      image_prompt,
      inspiration_texts: inspiration_texts.length > 0 ? inspiration_texts : [],
      generated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ post });
}
