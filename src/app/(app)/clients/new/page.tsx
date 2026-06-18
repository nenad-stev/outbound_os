import Link from "next/link";
import ClientForm from "../ClientForm";
import { createClientAction } from "@/app/actions/clients";

export default function NewClientPage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#272727", padding: "32px" }}>
      <Link
        href="/clients"
        style={{
          fontSize: "12px",
          color: "rgba(255,255,255,0.4)",
          textDecoration: "none",
          display: "inline-block",
          marginBottom: "12px",
        }}
      >
        ← Clients
      </Link>
      <h1 className="text-3xl font-bold text-white" style={{ marginBottom: "4px" }}>
        New client
      </h1>
      <p style={{ fontSize: "14px", color: "#BDBDBD", marginBottom: "32px" }}>
        Add a new client to your workspace.
      </p>
      <ClientForm action={createClientAction} submitLabel="Create client" />
    </div>
  );
}
