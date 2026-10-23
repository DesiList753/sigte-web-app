"use client";

import Link from "next/link";
import { Card, ProductBrand } from "@/components/ui-system";
import { I } from "@/components/Icon";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", padding: 24 }}>
      <Card style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
        <div style={{ display: "inline-flex", marginBottom: 20 }}>
          <ProductBrand />
        </div>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Algo salió mal</h1>
        <p style={{ color: "var(--ink-500)", fontSize: 13.5, marginBottom: 20 }}>
          Ocurrió un error inesperado. Puedes intentar de nuevo o volver al inicio.
        </p>
        <div className="row" style={{ gap: 8, justifyContent: "center" }}>
          <button className="btn primary" onClick={() => reset()}>
            <I name="refresh" size={18} /> Reintentar
          </button>
          <Link href="/" className="btn ghost">
            <I name="home" size={18} /> Volver al inicio
          </Link>
        </div>
      </Card>
    </main>
  );
}
