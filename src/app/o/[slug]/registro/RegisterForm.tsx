"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RegistrationForm } from "@prisma/client";
import { I } from "@/components/Icon";
import {
  EMPTY_PROFILE,
  ProfileFields,
  UserTypeToggle,
  profileComplete,
  profilePayload,
  type Profile,
  type UserType,
} from "@/components/ProfileFields";

const EMPTY = { name: "", email: "", password: "", phone: "" };

export function RegisterForm({
  slug,
  organizationName,
  form: kind,
  domains,
  approval,
  credentials,
}: {
  slug: string;
  organizationName: string;
  form: RegistrationForm;
  domains: string[];
  approval: boolean;
  credentials: boolean;
}) {
  const router = useRouter();
  const academic = kind === "ACADEMIC";
  const [userType, setUserType] = useState<UserType>("STUDENT");
  const [form, setForm] = useState(EMPTY);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const baseOk =
    form.name.trim().length >= 2 &&
    /.+@.+\..+/.test(form.email) &&
    form.password.length > 0 &&
    form.phone.trim().length >= 6;

  const canSubmit = baseOk && (!academic || profileComplete(userType, profile));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationSlug: slug,
          ...form,
          ...(academic ? profilePayload(userType, profile) : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.issues?.[0]?.message ?? data.error ?? "No se pudo completar el registro");
        return;
      }
      router.replace(data.home);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <p style={{ color: "var(--ink-500)", fontSize: 13.5, marginBottom: 20, lineHeight: 1.55 }}>
        Con tu cuenta registras tus vehículos y ves tus accesos en {organizationName}.{" "}
        {approval && "Tu ingreso queda pendiente hasta que la administración lo acepte. "}
        Si ya tienes cuenta en S.I.G.T.E., usa el mismo correo y contraseña para unirte.
      </p>

      <form onSubmit={submit} className="col" style={{ gap: 14 }}>
        {academic && <UserTypeToggle value={userType} onChange={setUserType} />}

        <div className="field">
          <label className="field-lbl" htmlFor="name">Nombre completo</label>
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

        {academic && (
          <ProfileFields
            userType={userType}
            profile={profile}
            credentials={credentials}
            onChange={(key, value) => setProfile((p) => ({ ...p, [key]: value }))}
          />
        )}

        <div className="field">
          <label className="field-lbl" htmlFor="email">Correo</label>
          <input
            id="email"
            className="input"
            type="email"
            required
            autoComplete="email"
            placeholder={domains.length > 0 ? `nombre@${domains[0]}` : "nombre@correo.cl"}
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
          {domains.length > 0 && (
            <span className="field-hint">Usa tu correo {domains.map((d) => `@${d}`).join(" o ")}.</span>
          )}
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
          <I name="userCheck" size={18} />{" "}
          {loading ? "Enviando…" : approval ? "Enviar solicitud" : "Crear mi cuenta"}
        </button>

        <p style={{ fontSize: 13, color: "var(--ink-500)", textAlign: "center", margin: 0 }}>
          ¿Ya tienes cuenta?{" "}
          <Link href={`/o/${slug}/login`} style={{ color: "var(--accent)", fontWeight: 600 }}>
            Inicia sesión
          </Link>
        </p>
      </form>
    </>
  );
}
