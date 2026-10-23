"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { I } from "@/components/Icon";

type Demo = { role: string; email: string; pw: string };

function safeNext(next: string | null) {
  return next && /^\/(?![/\\])/.test(next) ? next : null;
}

export function LoginForm({
  organizationSlug,
  registerHref,
  demo = [],
}: {
  organizationSlug?: string;
  registerHref: string | null;
  demo?: readonly Demo[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, organizationSlug }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Credenciales inválidas");
        return;
      }
      router.replace(safeNext(sp.get("next")) ?? data.home);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="col" style={{ gap: 14, textAlign: "left" }}>
      <div className="field">
        <label className="field-lbl" htmlFor="email">Correo</label>
        <input
          id="email"
          className="input"
          type="email"
          required
          placeholder="nombre@organizacion.cl"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoFocus
        />
      </div>
      <div className="field">
        <label className="field-lbl" htmlFor="password">Contraseña</label>
        <input
          id="password"
          className="input"
          type="password"
          required
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>

      {error && (
        <div className="field-err">
          <I name="alert" size={14} /> {error}
        </div>
      )}

      <button className="btn primary lg block" type="submit" disabled={loading || !email || !password}>
        <I name="login" size={19} /> {loading ? "Ingresando…" : "Ingresar"}
      </button>

      {registerHref && (
        <p style={{ fontSize: 13, color: "var(--ink-500)", textAlign: "center", margin: 0 }}>
          ¿No tienes cuenta?{" "}
          <Link href={registerHref} style={{ color: "var(--accent)", fontWeight: 600 }}>
            Regístrate
          </Link>
        </p>
      )}
      <p style={{ fontSize: 13, color: "var(--ink-500)", textAlign: "center", margin: 0 }}>
        <Link href="/forgot-password" style={{ color: "var(--accent)", fontWeight: 600 }}>
          ¿Olvidaste tu contraseña?
        </Link>
      </p>

      {demo.length > 0 && (
        <div className="card pad-sm" style={{ marginTop: 4 }}>
          <p
            style={{
              fontFamily: "var(--ff-mono)",
              fontSize: 11,
              letterSpacing: ".15em",
              textTransform: "uppercase",
              color: "var(--ink-500)",
              margin: "0 0 8px",
            }}
          >
            Credenciales demo
          </p>
          <div style={{ display: "grid", gap: 6 }}>
            {demo.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => {
                  setEmail(d.email);
                  setPassword(d.pw);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  background: "var(--surface)",
                  padding: "8px 11px",
                  cursor: "pointer",
                  fontFamily: "var(--ff-body)",
                  fontSize: 12.5,
                  textAlign: "left",
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--ink-900)" }}>{d.role}</span>
                <span style={{ fontFamily: "var(--ff-mono)", color: "var(--ink-500)" }}>{d.email}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
