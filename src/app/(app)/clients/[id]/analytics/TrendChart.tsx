"use client";

import { useState, useMemo } from "react";

interface PostData {
  id: string;
  topic: string | null;
  published_at: string | null;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
}

type Period = "week" | "month";
type Metric = "impressions" | "likes" | "comments";

const MONTH_LABELS = ["", "Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Avg", "Sep", "Okt", "Nov", "Dec"];

function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(wk).padStart(2, "0")}`;
}

function groupPosts(posts: PostData[], period: Period) {
  const map = new Map<string, { impressions: number; likes: number; comments: number; count: number }>();
  for (const p of posts) {
    if (!p.published_at) continue;
    const d = new Date(p.published_at);
    const key = period === "week"
      ? isoWeek(d)
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const prev = map.get(key) ?? { impressions: 0, likes: 0, comments: 0, count: 0 };
    map.set(key, {
      impressions: prev.impressions + (p.impressions ?? 0),
      likes:       prev.likes       + (p.likes       ?? 0),
      comments:    prev.comments    + (p.comments     ?? 0),
      count:       prev.count + 1,
    });
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => {
      const label = period === "week"
        ? `N${key.split("-W")[1]}`
        : MONTH_LABELS[parseInt(key.split("-")[1] ?? "0")] ?? key;
      return { label, ...val };
    });
}

const METRIC_LABELS: Record<Metric, string> = {
  impressions: "Impresije",
  likes: "Lajkovi",
  comments: "Komentari",
};

const METRIC_COLOR: Record<Metric, string> = {
  impressions: "#FFCC00",
  likes:       "#86EFAC",
  comments:    "#A5B4FC",
};

export default function TrendChart({ posts }: { posts: PostData[] }) {
  const [period, setPeriod] = useState<Period>("week");
  const [metric, setMetric] = useState<Metric>("impressions");

  const data = useMemo(() => groupPosts(posts, period), [posts, period]);
  const values = data.map((d) => d[metric]);
  const maxVal = Math.max(...values, 1);

  const W = 600, H = 180;
  const PAD = { top: 20, right: 20, bottom: 36, left: 52 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const n = data.length;

  const pts = data.map((d, i) => ({
    x: PAD.left + (n === 1 ? chartW / 2 : (i / (n - 1)) * chartW),
    y: PAD.top + chartH - (d[metric] / maxVal) * chartH,
    val: d[metric],
    label: d.label,
  }));

  const linePath = pts.length > 1
    ? pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")
    : "";

  const areaPath = pts.length > 1
    ? pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")
      + ` L ${pts[pts.length - 1].x.toFixed(1)} ${(PAD.top + chartH).toFixed(1)}`
      + ` L ${pts[0].x.toFixed(1)} ${(PAD.top + chartH).toFixed(1)} Z`
    : "";

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    y: PAD.top + chartH - f * chartH,
    label: Math.round(f * maxVal).toLocaleString("sr-RS"),
  }));

  const color = METRIC_COLOR[metric];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        {/* Period */}
        <div style={{ display: "flex", backgroundColor: "#1E1E1E", borderRadius: "10px", padding: "3px", gap: "2px" }}>
          {(["week", "month"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                backgroundColor: period === p ? "#303030" : "transparent",
                color: period === p ? "#FFFFFF" : "rgba(255,255,255,0.4)",
                border: "none", borderRadius: "8px",
                padding: "6px 14px", fontSize: "12px", fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {p === "week" ? "Nedeljno" : "Mesečno"}
            </button>
          ))}
        </div>
        {/* Metric */}
        <div style={{ display: "flex", gap: "6px" }}>
          {(["impressions", "likes", "comments"] as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              style={{
                backgroundColor: metric === m ? METRIC_COLOR[m] + "22" : "transparent",
                border: `1px solid ${metric === m ? METRIC_COLOR[m] + "55" : "rgba(255,255,255,0.08)"}`,
                color: metric === m ? METRIC_COLOR[m] : "rgba(255,255,255,0.4)",
                borderRadius: "8px", padding: "5px 12px", fontSize: "12px", fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {METRIC_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {n === 0 ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "180px", backgroundColor: "#303030", borderRadius: "14px", border: "1px dashed rgba(255,255,255,0.08)" }}>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.25)" }}>Nema objavljenih postova sa analitikom.</p>
        </div>
      ) : (
        <div style={{ backgroundColor: "#303030", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", overflow: "hidden" }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {gridLines.map((g, i) => (
              <g key={i}>
                <line x1={PAD.left} y1={g.y} x2={PAD.left + chartW} y2={g.y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                <text x={PAD.left - 6} y={g.y + 4} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="10">
                  {g.label}
                </text>
              </g>
            ))}

            {/* Area fill */}
            {areaPath && <path d={areaPath} fill="url(#areaGrad)" />}

            {/* Line */}
            {linePath && (
              <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            )}

            {/* Dots + tooltips */}
            {pts.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="4" fill={color} />
                <circle cx={p.x} cy={p.y} r="8" fill="transparent">
                  <title>{`${data[i].label}: ${p.val.toLocaleString("sr-RS")}`}</title>
                </circle>
                {/* X label */}
                {(n <= 12 || i % Math.ceil(n / 12) === 0) && (
                  <text
                    x={p.x} y={PAD.top + chartH + 18}
                    textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="10"
                  >
                    {p.label}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}
