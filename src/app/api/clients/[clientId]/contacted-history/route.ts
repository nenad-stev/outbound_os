import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { parseAndNormalize } from "@/lib/csv-normalizer";
import { randomUUID } from "crypto";

type Ctx = { params: Promise<{ clientId: string }> };

// GET — list batches with row counts for sidebar display
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { clientId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contacted_history")
    .select("batch_id, batch_name, source, uploaded_at")
    .eq("client_id", clientId)
    .order("uploaded_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by batch_id to get counts
  const map: Record<string, { batch_id: string; batch_name: string; source: string; uploaded_at: string; count: number }> = {};
  for (const row of (data ?? []) as any[]) {
    if (!map[row.batch_id]) {
      map[row.batch_id] = { batch_id: row.batch_id, batch_name: row.batch_name, source: row.source, uploaded_at: row.uploaded_at, count: 0 };
    }
    map[row.batch_id].count++;
  }

  return NextResponse.json({ batches: Object.values(map) });
}

// POST — upload CSV, extract linkedin_url + email, insert as a new batch
export async function POST(req: NextRequest, { params }: Ctx) {
  try { await requireRole("operator"); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const formData = await req.formData();
  const file = formData.get("csv_file") as File | null;

  if (!file || file.size === 0) return NextResponse.json({ error: "Nema fajla." }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".csv")) return NextResponse.json({ error: "Mora biti .csv." }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Fajl preveliki (max 20MB)." }, { status: 400 });

  const csvText = await file.text();
  const { leads, format, skipped } = parseAndNormalize(csvText);

  if (leads.length === 0) {
    return NextResponse.json({ error: `Nema validnih leadova. Format: ${format}. Preskočeno: ${skipped}.` }, { status: 400 });
  }

  const batchId = randomUUID();
  const batchName = file.name.replace(/\.csv$/i, "");
  const source = format === "lgm" ? "lgm" : format === "apollo" ? "apollo" : "manual";
  const uploadedAt = new Date().toISOString();

  const rows = leads
    .filter((l) => l.linkedin_url || l.email)
    .map((l) => ({
      client_id: clientId,
      batch_id: batchId,
      batch_name: batchName,
      source,
      linkedin_url: l.linkedin_url ?? null,
      email: l.email ?? null,
      first_name: l.first_name || null,
      last_name: l.last_name || null,
      uploaded_at: uploadedAt,
    }));

  if (rows.length === 0) {
    return NextResponse.json({ error: "Nema redova sa linkedin_url ili email poljem." }, { status: 400 });
  }

  const supabase = await createClient();

  // Insert in chunks to avoid payload limits
  const CHUNK = 1000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from("contacted_history").insert(rows.slice(i, i + CHUNK));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inserted: rows.length, skipped: leads.length - rows.length, batchId, format });
}

// DELETE — remove an entire batch by batch_id (query param)
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try { await requireRole("operator"); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const batchId = new URL(req.url).searchParams.get("batchId");
  if (!batchId) return NextResponse.json({ error: "batchId required" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase
    .from("contacted_history")
    .delete()
    .eq("client_id", clientId)
    .eq("batch_id", batchId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
