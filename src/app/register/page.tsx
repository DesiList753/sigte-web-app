"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { I } from "@/components/Icon";
import { Brand, Card } from "@/components/ui-system";
import { formatRut, isValidRut } from "@/lib/rut";

type UserType = "STAFF" | "STUDENT";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const organizationSlug = useSearchParams().get("org");
  const [userType, setUserType] = useState<UserType>("STUDENT");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    universityId: "",
    position: "",
    department: "",
    rut: "",
    academicDepartment: "",
    career: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const rutOk = useMemo(() => form.rut === "" || isValidRut(form.rut), [form.rut]);

  const canSubmit =
    form.name.trim().length >= 2 &&
    /.+@.+\..+/.test(form.email) &&
    form.password.length >= 8 &&
    form.phone.trim().length >= 6 &&
    (userType === "STAFF"
      ? form.position.trim() !== "" && form.department.trim() !== ""
      : isValidRut(form.rut) && form.academicDepartment.trim() !== "" && form.career.trim() !== "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload =
        userType === "STAFF"
          ? {
              userType,
              organizationSlug,
              name: form.name,
              email: form.email,
              password: form.password,
              phone: form.phone,
              universityId: form.universityId || undefined,
              position: form.position,
              department: form.department,
            }
          : {
              userType,
              organizationSlug,
              name: form.name,
              email: form.email,
              password: form.password,
              phone: form.phone,
              universityId: form.universityId || undefined,
              rut: formatRut(form.rut),
              academicDepartment: form.academicDepartment,
              career: form.career,
            };

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo completar el registro");
        return;
      }
      router.replace(data.home);
    } finally {
      setLoading(false);
    }
  }

  if (!organizationSlug) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", padding: 24 }}>
        <Card style={{ width: "100%", maxWidth: 460 }}>
          <div style={{ display: "inline-flex", marginBottom: 20 }}>
            <Brand />
          </div>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Crear cuenta</h1>
          <p style={{ color: "var(--ink-500)", fontSize: 13.5, marginBottom: 20 }}>
            Para crear tu cuenta usa el enlace de registro que te entregó tu organización.
          </p>
          <Link href="/login" className="btn secondary block">
            Volver a iniciar sesión
          </Link>
        </Card>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", padding: 24 }}>
      <Card style={{ width: "100%", maxWidth: 460 }}>
        <div style={{ display: "inline-flex", marginBottom: 20 }}>
          <Brand />
        </div>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Crear cuenta</h1>
        <p style={{ color: "var(--ink-500)", fontSize: 13.5, marginBottom: 20 }}>
          Registro como usuario del campus.
        </p>

        <div className="field" style={{ marginBottom: 14 }}>
          <label className="field-lbl">Tipo de usuario</label>
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className={"btn block " + (userType === "STUDENT" ? "primary" : "ghost")}
              onClick={() => setUserType("STUDENT")}
            >
              <I name="userCheck" size={16} /> Alumno
            </button>
            <button
              type="button"
              className={"btn block " + (userType === "STAFF" ? "primary" : "ghost")}
              onClick={() => setUserType("STAFF")}
            >
              <I name="userCheck" size={16} /> Funcionario / Docente
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="col" style={{ gap: 14 }}>
          <div className="field">
            <label className="field-lbl" htmlFor="name">Nombre completo</label>
            <input
              id="name"
              className="input"
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          {userType === "STUDENT" && (
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
              placeholder="+56 9 1234 5678"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>

          {userType === "STAFF" ? (
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
          ) : (
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

          <div className="field">
            <label className="field-lbl" htmlFor="universityId">
              Credencial universitaria <span className="muted">(opcional)</span>
            </label>
            <input
              id="universityId"
              className="input"
              placeholder="USR-2026-123"
              value={form.universityId}
              onChange={(e) => set("universityId", e.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-lbl" htmlFor="email">Correo</label>
            <input
              id="email"
              className="input"
              type="email"
              required
              placeholder="nombre.apellido@usm.cl"
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
              placeholder="••••••••"
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
            <I name="userCheck" size={18} /> {loading ? "Creando…" : "Registrarme"}
          </button>

          <p style={{ fontSize: 13, color: "var(--ink-500)", textAlign: "center", margin: 0 }}>
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
              Inicia sesión
            </Link>
          </p>
        </form>
      </Card>
    </main>
  );
}
