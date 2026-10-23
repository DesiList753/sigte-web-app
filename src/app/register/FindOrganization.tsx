"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { I } from "@/components/Icon";
import { Card, ProductBrand } from "@/components/ui-system";
import { slugify } from "@/lib/slug";

function codeFrom(value: string) {
  const match = value.match(/\/o\/([^/?#\s]+)/);
  return slugify(match ? match[1] : value);
}

export function FindOrganization() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const code = codeFrom(value);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code) router.push(`/o/${code}/registro`);
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", padding: 24 }}>
      <Card style={{ width: "100%", maxWidth: 460 }}>
        <Link
          href="/"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-500)", marginBottom: 18 }}
        >
          <I name="chevronLeft" size={16} /> Volver al inicio
        </Link>
        <div style={{ display: "flex", marginBottom: 22 }}>
          <ProductBrand />
        </div>
        <h1 style={{ fontSize: 22, marginBottom: 6 }}>Crear mi cuenta</h1>
        <p style={{ color: "var(--ink-500)", fontSize: 13.5, marginBottom: 20, lineHeight: 1.55 }}>
          Tu cuenta se crea dentro de tu organización. Escribe su código o pega el enlace que te entregó.
        </p>
        <form onSubmit={submit} className="col" style={{ gap: 14 }}>
          <div className="field">
            <label className="field-lbl" htmlFor="org-code">Código de tu organización</label>
            <input
              id="org-code"
              className="input"
              required
              autoFocus
              autoCapitalize="none"
              spellCheck={false}
              placeholder="mi-organizacion"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <span className="field-hint">
              Es la última parte del enlace: …/o/<b>{code || "mi-organizacion"}</b>
            </span>
          </div>
          <button className="btn primary block" type="submit" disabled={!code}>
            <I name="search" size={18} /> Buscar
          </button>
        </form>
        <hr className="divider" style={{ margin: "20px 0 16px" }} />
        <div className="col" style={{ gap: 8, fontSize: 13, color: "var(--ink-500)", textAlign: "center" }}>
          <span>
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" style={{ fontWeight: 600 }}>
              Inicia sesión
            </Link>
          </span>
          <span>
            ¿Quieres usar S.I.G.T.E en tu organización?{" "}
            <Link href="/crear-organizacion" style={{ fontWeight: 600 }}>
              Crea su cuenta
            </Link>
          </span>
        </div>
      </Card>
    </main>
  );
}
