import Link from "next/link";
import { I } from "@/components/Icon";
import { Card, ProductBrand } from "@/components/ui-system";

export default function OrganizationNotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", padding: 24 }}>
      <Card style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ display: "inline-flex", marginBottom: 20 }}>
          <ProductBrand />
        </div>
        <h1 style={{ fontSize: 22, marginBottom: 6 }}>No encontramos esa organización</h1>
        <p style={{ color: "var(--ink-500)", fontSize: 13.5, marginBottom: 20, lineHeight: 1.55 }}>
          Revisa el enlace que te entregó tu organización o búscala con su código.
        </p>
        <div className="col" style={{ gap: 10 }}>
          <Link href="/register" className="btn primary block">
            <I name="search" size={18} /> Buscar mi organización
          </Link>
          <Link href="/" className="btn ghost block">
            Ir al inicio
          </Link>
        </div>
      </Card>
    </main>
  );
}
