"use client";

import Link from "next/link";
import { Suspense } from "react";
import { I } from "@/components/Icon";
import { LoginForm } from "@/components/LoginForm";
import { ProductBrand } from "@/components/ui-system";
import st from "./login.module.css";

export default function LoginPage() {
  return (
    <main className={st.split}>
      <div className={st.formSide}>
        <div className={st.formInner}>
          <div style={{ textAlign: "left", marginBottom: 18 }}>
            <Link
              href="/"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-500)" }}
            >
              <I name="chevronLeft" size={16} /> Volver al inicio
            </Link>
          </div>
          <div style={{ display: "inline-flex", marginBottom: 28 }}>
            <ProductBrand />
          </div>
          <h1 style={{ fontSize: 26, marginBottom: 24 }}>Bienvenido a S.I.G.T.E</h1>
          <Suspense fallback={<p className="muted" style={{ fontSize: 13 }}>Cargando…</p>}>
            <LoginForm registerHref="/register" />
          </Suspense>
        </div>
      </div>
      <div className={st.aside}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(circle at 1px 1px,rgba(255,255,255,.1) 1px,transparent 0)",
            backgroundSize: "22px 22px",
            opacity: 0.6,
          }}
        />
        <div style={{ position: "relative", color: "#fff", textAlign: "center", padding: 40 }}>
          <div
            style={{
              fontFamily: "var(--ff-mono)",
              fontSize: 11,
              letterSpacing: ".18em",
              color: "var(--amarillo)",
              marginBottom: 14,
            }}
          >
            CONTROL DE ACCESO VEHICULAR
          </div>
          <div
            style={{
              fontFamily: "var(--ff-display)",
              fontWeight: 700,
              fontSize: 34,
              lineHeight: 1.1,
              maxWidth: "14ch",
              margin: "0 auto",
            }}
          >
            Cada patente, cada acceso, en un solo lugar.
          </div>
        </div>
      </div>
    </main>
  );
}
