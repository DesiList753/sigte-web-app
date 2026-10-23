"use client";

import Link from "next/link";
import { useState } from "react";
import { I } from "@/components/Icon";
import { Card, ProductBrand } from "@/components/ui-system";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", padding: 24 }}>
      <Card style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "inline-flex", marginBottom: 20 }}>
          <ProductBrand />
        </div>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Recuperar contraseña</h1>
        <p style={{ color: "var(--ink-500)", fontSize: 13.5, marginBottom: 20 }}>
          Ingresa tu correo institucional y te enviaremos un enlace para restablecer tu contraseña.
        </p>

        {sent ? (
          <div className="field-hint" style={{ fontSize: 13.5 }}>
            Si el correo existe en el sistema, recibirás un mensaje con las instrucciones en unos minutos.
          </div>
        ) : (
          <form onSubmit={submit} className="col" style={{ gap: 14 }}>
            <div className="field">
              <label className="field-lbl" htmlFor="email">Correo institucional</label>
              <input
                id="email"
                className="input"
                type="email"
                required
                placeholder="nombre@organizacion.cl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>
            <button className="btn primary block" type="submit" disabled={loading || !email}>
              <I name="login" size={18} /> {loading ? "Enviando…" : "Enviar enlace"}
            </button>
          </form>
        )}

        <p style={{ fontSize: 13, color: "var(--ink-500)", textAlign: "center", margin: "16px 0 0" }}>
          <Link href="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
            Volver a iniciar sesión
          </Link>
        </p>
      </Card>
    </main>
  );
}
