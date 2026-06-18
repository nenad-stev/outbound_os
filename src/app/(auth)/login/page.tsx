import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <main style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", backgroundColor: "#272727", padding: "0 16px" }}>
      <div style={{ width: "100%", maxWidth: "400px", backgroundColor: "#303030", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "20px", padding: "40px" }}>
        {/* Brand */}
        <div style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "#FFCC00", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "16px", fontWeight: 800, color: "#272727" }}>L</span>
            </div>
            <span style={{ fontSize: "18px", fontWeight: 700, color: "#FFFFFF" }}>Lead Agents OS</span>
          </div>
          <p style={{ fontSize: "14px", color: "#BDBDBD" }}>Sign in to your workspace.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
