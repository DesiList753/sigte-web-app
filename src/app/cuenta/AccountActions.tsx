"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { I } from "@/components/Icon";
import { slugify } from "@/lib/slug";

export function EnterButton({ organizationId }: { organizationId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enter() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(data.error ?? "No se pudo entrar");
      return;
    }
    window.location.assign(data.home);
  }

  return (
    <span className="col" style={{ gap: 4, alignItems: "flex-end" }}>
      <button className="btn primary" onClick={enter} disabled={busy}>
        <I name="login" size={16} /> {busy ? "Entrando…" : "Entrar"}
      </button>
      {error && <span className="field-err">{error}</span>}
    </span>
  );
}

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }
  return (
    <button className="btn ghost" onClick={logout}>
      <I name="logout" size={16} /> Cerrar sesión
    </button>
  );
}

function codeFrom(value: string) {
  const match = value.match(/\/o\/([^/?#\s]+)/);
  return slugify(match ? match[1] : value);
}

export function JoinByCode() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const code = codeFrom(value);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code) router.push(`/cuenta/unirse/${code}`);
  }

  return (
    <form onSubmit={submit} className="col" style={{ gap: 10 }}>
      <div className="field">
        <label className="field-lbl" htmlFor="org-code">Código o enlace de la organización</label>
        <div className="row" style={{ gap: 8 }}>
          <input
            id="org-code"
            className="input"
            required
            autoCapitalize="none"
            spellCheck={false}
            placeholder="mi-organizacion"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{ flex: 1, minWidth: 0 }}
          />
          <button className="btn secondary" type="submit" disabled={!code}>
            <I name="search" size={16} /> Buscar
          </button>
        </div>
        <span className="field-hint">
          Es la última parte del enlace que te entregó: …/o/<b>{code || "mi-organizacion"}</b>
        </span>
      </div>
    </form>
  );
}
