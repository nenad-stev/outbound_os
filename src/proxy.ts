import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // Allow internal sync/import calls with a pre-shared secret to bypass auth
  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/heyreach/")) {
    const secret = request.headers.get("x-sync-secret");
    if (secret && secret === process.env.SYNC_SECRET) {
      return NextResponse.next();
    }
  }

  return await updateSession(request);
}

export const config = {
  // Run on everything except static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
