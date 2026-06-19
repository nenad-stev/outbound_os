import type { NextConfig } from "next";
import { execSync } from "node:child_process";

// Resolve the build's version at BUILD time so it works everywhere:
// - On Vercel, system env vars are always present during the build (even if
//   not exposed to the runtime), so we read them here and bake them in.
// - Locally, fall back to reading git directly so dev also shows a real SHA.
function gitValue(cmd: string): string {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

const COMMIT_SHA =
  process.env.VERCEL_GIT_COMMIT_SHA || gitValue("git rev-parse HEAD") || "";
const COMMIT_MSG =
  process.env.VERCEL_GIT_COMMIT_MESSAGE || gitValue("git log -1 --format=%s") || "";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_COMMIT_SHA: COMMIT_SHA,
    NEXT_PUBLIC_COMMIT_MSG: COMMIT_MSG,
  },
};

export default nextConfig;
