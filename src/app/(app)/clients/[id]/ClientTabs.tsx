"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Tab { label: string; seg: string | null; group?: boolean }

// seg === null → overview (exact match). Otherwise matched as a path segment.
const TABS: Tab[] = [
  { label: "Overview", seg: null },
  { label: "🚀 Pokreni", seg: "launch" },
  { label: "ICP", seg: "icp", group: true },
  { label: "Senders", seg: "profiles" },
  { label: "Audiences", seg: "audiences", group: true },
  { label: "Review", seg: "review" },
  { label: "Campaigns", seg: "campaigns", group: true },
  { label: "Ledger", seg: "ledger" },
  { label: "Rotation", seg: "rotation" },
  { label: "Follow-ups", seg: "followups" },
  { label: "Content", seg: "content", group: true },
  { label: "Analytics", seg: "analytics" },
];

export default function ClientTabs({ clientId }: { clientId: string }) {
  const pathname = usePathname();
  const base = `/clients/${clientId}`;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "2px",
        overflowX: "auto",
        paddingBottom: "2px",
      }}
    >
      {TABS.map((tab) => {
        const href = tab.seg ? `${base}/${tab.seg}` : base;
        const active = tab.seg
          ? pathname.startsWith(`${base}/${tab.seg}`)
          : pathname === base;
        return (
          <span key={tab.label} style={{ display: "inline-flex", alignItems: "center" }}>
            {tab.group && (
              <span style={{ width: "1px", height: "16px", backgroundColor: "rgba(255,255,255,0.1)", margin: "0 6px" }} />
            )}
            <Link href={href} className="client-tab" data-active={active}>
              {tab.label}
            </Link>
          </span>
        );
      })}
    </div>
  );
}
