"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { I } from "@/components/Icon";
import { Card, ProductBrand } from "@/components/ui-system";

export function AccountForm({ next, email }: { next: string | null; email: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", phone: "", email, password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const canSubmit =
    form.name.trim().length >= 2 &&
    form.phone.trim().length >= 6 &&
    /.+@.+\..+/.test(form.email) &&
    form.password.length >= 8;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.issues?.[0]?.message ?? data.error ?? "No se pudo crear la cuenta");
        return;
      }
      router.replace(next ?? data.home);
    } finally {
      setLoading(false);
    }
  }

  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

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
          Con una sola cuenta puedes unirte a los estacionamientos de varias organizaciones. Después de crearla
          eliges a cuál quieres entrar.
        </p>
        <form onSubmit={submit} className="col" style={{ gap: 14 }}>
          <div className="field">
            <label className="field-lbl" htmlFor="name">Nombre completo</label>
            <input
              id="name"
              className="input"
              required
              autoFocus
              autoComplete="name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-lbl" htmlFor="phone">Teléfono</label>
            <input
              id="phone"
              className="input"
              required
              type="tel"
              autoComplete="tel"
              placeholder="+56 9 1234 5678"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-lbl" htmlFor="email">Correo</label>
            <input
              id="email"
              className="input"
              type="email"
              required
              autoComplete="email"
              placeholder="nombre@correo.cl"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-lbl" htmlFor="password">Contraseña</label>
            <input
              id="password"
              className="input"
              type="password"
              required
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
            />
          </div>

          {error && (
            <div className="field-err">
              <I name="alert" size={14} /> {error}
            </div>
          )}

          <button className="btn primary block" type="submit" disabled={loading || !canSubmit}>
            <I name="userCheck" size={18} /> {loading ? "Creando…" : "Crear mi cuenta"}
          </button>
        </form>
        <hr className="divider" style={{ margin: "20px 0 16px" }} />
        <div className="col" style={{ gap: 8, fontSize: 13, color: "var(--ink-500)", textAlign: "center" }}>
          <span>
            ¿Ya tienes cuenta?{" "}
            <Link href={loginHref} style={{ fontWeight: 600 }}>
              Inicia sesión
            </Link>
          </span>
          <span>
            ¿Quieres usar S.I.G.T.E. en tu organización?{" "}
            <Link href="/crear-organizacion" style={{ fontWeight: 600 }}>
              Crea su cuenta
            </Link>
          </span>
        </div>
      </Card>
    </main>
  );
}
