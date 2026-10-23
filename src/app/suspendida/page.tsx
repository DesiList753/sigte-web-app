"use client";

import { useRouter } from "next/navigation";
import { I } from "@/components/Icon";
import { Card, ProductBrand } from "@/components/ui-system";

export default function SuspendedPage() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", padding: 24 }}>
      <Card style={{ width: "100%", maxWidth: 460 }}>
        <div style={{ display: "inline-flex", marginBottom: 20 }}>
          <ProductBrand />
        </div>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Cuenta suspendida</h1>
        <p style={{ color: "var(--ink-500)", fontSize: 13.5, marginBottom: 20 }}>
          La cuenta de tu organización está suspendida. Contacta al administrador de tu organización.
        </p>
        <button className="btn secondary block" onClick={logout}>
          <I name="logout" size={17} /> Cerrar sesión
        </button>
      </Card>
    </main>
  );
}
