"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { I } from "@/components/Icon";
import { Card, ProductBrand } from "@/components/ui-system";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo actualizar la contraseña");
        return;
      }
      setDone(true);
      setTimeout(() => router.replace("/login"), 2000);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="field-err">
        <I name="alert" size={14} /> Enlace inválido. Solicita uno nuevo desde{" "}
        <Link href="/forgot-password">recuperar contraseña</Link>.
      </div>
    );
  }

  if (done) {
    return (
      <div className="field-hint" style={{ fontSize: 13.5 }}>
        Contraseña actualizada. Te llevamos al inicio de sesión…
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="col" style={{ gap: 14 }}>
      <div className="field">
        <label className="field-lbl" htmlFor="password">Nueva contraseña</label>
        <input
          id="password"
          className="input"
          type="password"
          required
          minLength={8}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
      </div>
      <div className="field">
        <label className="field-lbl" htmlFor="confirm">Confirma la contraseña</label>
        <input
          id="confirm"
          className="input"
          type="password"
          required
          minLength={8}
          placeholder="••••••••"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {error && (
        <div className="field-err">
          <I name="alert" size={14} /> {error}
        </div>
      )}
      <button className="btn primary block" type="submit" disabled={loading || password.length < 8}>
        {loading ? "Actualizando…" : "Actualizar contraseña"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", padding: 24 }}>
      <Card style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "inline-flex", marginBottom: 20 }}>
          <ProductBrand />
        </div>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Nueva contraseña</h1>
        <p style={{ color: "var(--ink-500)", fontSize: 13.5, marginBottom: 20 }}>
          Elige una nueva contraseña para tu cuenta.
        </p>
        <Suspense fallback={<p className="muted" style={{ fontSize: 13 }}>Cargando…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </Card>
    </main>
  );
}
