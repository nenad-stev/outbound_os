import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";

const NAV = [
  {
    label: "WORKSPACE",
    items: [
      { href: "/",        label: "Dashboard" },
      { href: "/clients", label: "Clients" },
      { href: "/people",  label: "People" },
    ],
  },
  {
    label: "INTEGRACIJE",
    items: [
      { href: "/settings/heyreach", label: "HeyReach" },
    ],
  },
];

// Deploy identity — Vercel injects these system env vars on every build, so
// the badge changes with each push. Lets us confirm at a glance which version
// is live ("aha, my push deployed").
const COMMIT_SHA = (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || "local";
const COMMIT_MSG = (process.env.VERCEL_GIT_COMMIT_MESSAGE ?? "").split("\n")[0];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#272727" }}>
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className="flex w-64 shrink-0 flex-col overflow-y-auto"
        style={{
          backgroundColor: "#1E1E1E",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center px-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold"
              style={{ backgroundColor: "#FFCC00", color: "#272727" }}
            >
              LA
            </div>
            <div>
              <p className="text-sm font-700 tracking-tight" style={{ color: "#FFFFFF", fontWeight: 700 }}>
                Lead Agents
              </p>
              <p className="text-xs" style={{ color: "#BDBDBD" }}>
                Outbound OS
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4">
          {NAV.map((section) => (
            <div key={section.label} className="mb-6">
              <p
                className="mb-2 px-3 text-xs font-semibold uppercase tracking-widest"
                style={{ color: "rgba(255,255,255,0.3)", letterSpacing: "0.10em" }}
              >
                {section.label}
              </p>
              {section.items.map((item) => (
                <NavItem key={item.href} href={item.href} label={item.label} />
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="shrink-0 px-3 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div
            className="mb-3 rounded-xl px-3 py-3"
            style={{ backgroundColor: "#272727" }}
          >
            <p className="truncate text-xs font-semibold" style={{ color: "#FFFFFF" }}>
              {user.email}
            </p>
            <p className="mt-0.5 text-xs uppercase tracking-wider" style={{ color: "#BDBDBD" }}>
              {user.role}
            </p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              Sign out →
            </button>
          </form>

          {/* Deploy / version badge */}
          <div
            className="mt-3 rounded-lg px-3 py-2"
            style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            title={COMMIT_MSG || "Lokalni build"}
          >
            <p className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.45)", fontFamily: "monospace" }}>
              <span style={{ color: "#86EFAC" }}>●</span> v{COMMIT_SHA}
            </p>
            {COMMIT_MSG && (
              <p className="mt-0.5 truncate text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                {COMMIT_MSG}
              </p>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1400px] px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150"
      style={{ color: "#BDBDBD" }}
    >
      <span className="flex-1">{label}</span>
    </Link>
  );
}
