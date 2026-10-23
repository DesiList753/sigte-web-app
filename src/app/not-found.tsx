import Link from "next/link";
import { Card, ProductBrand } from "@/components/ui-system";
import { I } from "@/components/Icon";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", padding: 24 }}>
      <Card style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
        <div style={{ display: "inline-flex", marginBottom: 20 }}>
          <ProductBrand />
        </div>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Página no encontrada</h1>
        <p style={{ color: "var(--ink-500)", fontSize: 13.5, marginBottom: 20 }}>
          La página que buscas no existe o fue movida.
        </p>
        <Link href="/" className="btn primary block">
          <I name="home" size={18} /> Volver al inicio
        </Link>
      </Card>
    </main>
  );
}
