"use client";

export default function CopyButton({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(text)}
      style={{ backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", borderRadius: "10px", padding: "6px 12px", fontSize: "12px", cursor: "pointer" }}
    >
      Kopiraj
    </button>
  );
}
