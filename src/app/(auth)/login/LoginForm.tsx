"use client";

import { useActionState } from "react";
import { signIn, type AuthState } from "@/app/actions/auth";

const initial: AuthState = { error: null };

const inputStyle = {
  backgroundColor: "#3B3B3B",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "12px",
  color: "#FFFFFF",
  padding: "10px 14px",
  fontSize: "14px",
  width: "100%",
  outline: "none",
};

const labelStyle = {
  fontSize: "12px",
  fontWeight: 600 as const,
  color: "rgba(255,255,255,0.35)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  marginBottom: "6px",
  display: "block",
};

export default function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initial);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <label htmlFor="email" style={labelStyle}>Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="password" style={labelStyle}>Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          style={inputStyle}
        />
      </div>

      {state.error && (
        <p style={{ fontSize: "13px", color: "#F87171", backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "10px", padding: "10px 14px" }} role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        style={{ backgroundColor: "#FFCC00", color: "#272727", fontWeight: 600, borderRadius: "12px", padding: "12px 20px", fontSize: "14px", border: "none", cursor: pending ? "not-allowed" : "pointer", opacity: pending ? 0.6 : 1, marginTop: "4px" }}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
