"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { I } from "@/components/Icon";
import { SLUG_PATTERN, slugify } from "@/lib/slug";

const EMPTY = { organizationName: "", slug: "", name: "", email: "", password: "", website: "" };

export function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setOrganizationName(value: string) {
    setForm((f) => ({ ...f, organizationName: value, slug: slugTouched ? f.slug : slugify(value) }));
  }

  const slugOk = form.slug.length >= 3 && SLUG_PATTERN.test(form.slug);
  const canSubmit =
    form.organizationName.trim().length >= 2 &&
    slugOk &&
    form.name.trim().length >= 2 &&
    /.+@.+\..+/.test(form.email) &&
    form.password.length >= 8;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.issues?.[0]?.message ?? data.error ?? "No se pudo crear la cuenta");
        return;
      }
      router.replace(data.home);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="col" style={{ gap: 14 }}>
      <div className="field">
        <label className="field-lbl" htmlFor="organizationName">Nombre de la organización</label>
        <input
          id="organizationName"
          className="input"
          required
          autoFocus
          autoComplete="organization"
          placeholder="Clínica Los Andes"
          value={form.organizationName}
          onChange={(e) => setOrganizationName(e.target.value)}
        />
      </div>
      <div className="field">
        <label className="field-lbl" htmlFor="slug">Código de la organización</label>
        <input
          id="slug"
          className="input mono"
          style={{ textTransform: "none" }}
          required
          autoCapitalize="none"
          spellCheck={false}
          placeholder="clinica-los-andes"
          value={form.slug}
          onChange={(e) => {
            setSlugTouched(true);
            set("slug", e.target.value.toLowerCase());
          }}
        />
        {form.slug && !slugOk ? (
          <span className="field-err" style={{ marginTop: 4 }}>
            <I name="alert" size={13} /> Usa al menos 3 letras o números, sin espacios. Separa con guiones.
          </span>
        ) : (
          <span className="field-hint">
            Tus usuarios crearán su cuenta en …/o/<b>{form.slug || "tu-organizacion"}</b>
          </span>
        )}
      </div>
      <div className="field">
        <label className="field-lbl" htmlFor="name">Tu nombre</label>
        <input
          id="name"
          className="input"
          required
          autoComplete="name"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </div>
      <div className="field">
        <label className="field-lbl" htmlFor="email">Tu correo</label>
        <input
          id="email"
          className="input"
          type="email"
          required
          autoComplete="email"
          placeholder="nombre@organizacion.cl"
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
          minLength={8}
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
        />
      </div>
      <div aria-hidden="true" style={{ position: "absolute", left: -10000, width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="website">Sitio web</label>
        <input
          id="website"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(e) => set("website", e.target.value)}
        />
      </div>

      {error && (
        <div className="field-err">
          <I name="alert" size={14} /> {error}
        </div>
      )}

      <button className="btn primary lg block" type="submit" disabled={loading || !canSubmit}>
        {loading ? "Creando cuenta…" : "Crear cuenta"} <I name="arrowRight" size={18} />
      </button>

      <p style={{ fontSize: 13, color: "var(--ink-500)", textAlign: "center", margin: 0 }}>
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
