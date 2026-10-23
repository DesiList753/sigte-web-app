"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { RegistrationForm } from "@prisma/client";
import { I } from "@/components/Icon";
import { formatRut, isValidRut } from "@/lib/rut";

type UserType = "STAFF" | "STUDENT";

const EMPTY = {
  name: "",
  email: "",
  password: "",
  phone: "",
  credentialId: "",
  position: "",
  department: "",
  rut: "",
  academicDepartment: "",
  career: "",
};

export function RegisterForm({
  slug,
  organizationName,
  form: kind,
  domains,
}: {
  slug: string;
  organizationName: string;
  form: RegistrationForm;
  domains: string[];
}) {
  const router = useRouter();
  const academic = kind === "ACADEMIC";
  const [userType, setUserType] = useState<UserType>("STUDENT");
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const rutOk = useMemo(() => form.rut === "" || isValidRut(form.rut), [form.rut]);

  const baseOk =
    form.name.trim().length >= 2 &&
    /.+@.+\..+/.test(form.email) &&
    form.password.length > 0 &&
    form.phone.trim().length >= 6;

  const canSubmit =
    baseOk &&
    (!academic ||
      (userType === "STAFF"
        ? form.position.trim() !== "" && form.department.trim() !== ""
        : isValidRut(form.rut) && form.academicDepartment.trim() !== "" && form.career.trim() !== ""));

  function payload() {
    const base = {
      organizationSlug: slug,
      name: form.name,
      email: form.email,
      password: form.password,
      phone: form.phone,
    };
    if (!academic) return base;
    const credentialId = form.credentialId || undefined;
    return userType === "STAFF"
      ? { ...base, userType, credentialId, position: form.position, department: form.department }
      : {
          ...base,
          userType,
          credentialId,
          rut: formatRut(form.rut),
          academicDepartment: form.academicDepartment,
          career: form.career,
        };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
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
        Con tu cuenta registras tus vehículos y ves tus accesos en {organizationName}. Si ya tienes cuenta en
        S.I.G.T.E por otra organización, usa el mismo correo y contraseña para unirte.
      </p>

      {academic && (
        <div className="field" style={{ marginBottom: 14 }}>
          <span className="field-lbl">Tipo de usuario</span>
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className={"btn block " + (userType === "STUDENT" ? "primary" : "ghost")}
              aria-pressed={userType === "STUDENT"}
              onClick={() => setUserType("STUDENT")}
            >
              Alumno
            </button>
            <button
              type="button"
              className={"btn block " + (userType === "STAFF" ? "primary" : "ghost")}
              aria-pressed={userType === "STAFF"}
              onClick={() => setUserType("STAFF")}
            >
              Funcionario o docente
            </button>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="col" style={{ gap: 14 }}>
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

        {academic && userType === "STUDENT" && (
          <div className="field">
            <label className="field-lbl" htmlFor="rut">RUT</label>
            <input
              id="rut"
              className="input"
              required
              placeholder="12.345.678-9"
              value={form.rut}
              onChange={(e) => set("rut", e.target.value)}
              onBlur={(e) => e.target.value && isValidRut(e.target.value) && set("rut", formatRut(e.target.value))}
            />
            {!rutOk && (
              <span className="field-err" style={{ marginTop: 4 }}>
                <I name="alert" size={13} /> RUT inválido
              </span>
            )}
          </div>
        )}

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

        {academic && userType === "STAFF" && (
          <>
            <div className="field">
              <label className="field-lbl" htmlFor="position">Cargo</label>
              <input
                id="position"
                className="input"
                required
                placeholder="Docente, Secretaria, Técnico…"
                value={form.position}
                onChange={(e) => set("position", e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-lbl" htmlFor="department">Departamento o Unidad</label>
              <input
                id="department"
                className="input"
                required
                placeholder="Depto. de Informática, Bienestar…"
                value={form.department}
                onChange={(e) => set("department", e.target.value)}
              />
            </div>
          </>
        )}

        {academic && userType === "STUDENT" && (
          <>
            <div className="field">
              <label className="field-lbl" htmlFor="academicDepartment">Departamento Académico</label>
              <input
                id="academicDepartment"
                className="input"
                required
                placeholder="Depto. de Informática"
                value={form.academicDepartment}
                onChange={(e) => set("academicDepartment", e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-lbl" htmlFor="career">Carrera</label>
              <input
                id="career"
                className="input"
                required
                placeholder="Ingeniería Civil Informática"
                value={form.career}
                onChange={(e) => set("career", e.target.value)}
              />
            </div>
          </>
        )}

        {academic && (
          <div className="field">
            <label className="field-lbl" htmlFor="credentialId">
              Credencial <span className="muted">(opcional)</span>
            </label>
            <input
              id="credentialId"
              className="input"
              placeholder="USR-2026-123"
              value={form.credentialId}
              onChange={(e) => set("credentialId", e.target.value)}
            />
          </div>
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
          <I name="userCheck" size={18} /> {loading ? "Creando…" : "Crear mi cuenta"}
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
