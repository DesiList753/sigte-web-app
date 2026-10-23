"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, OrgBrand } from "@/components/ui-system";
import { I } from "@/components/Icon";
import { HEX_COLOR, readableOnWhite } from "@/lib/color";
import { orgTheme } from "@/lib/theme";

type RegistrationForm = "BASIC" | "ACADEMIC";

type Settings = {
  slug: string;
  name: string;
  displayName: string;
  logoUrl: string | null;
  brandColor: string | null;
  registrationForm: RegistrationForm;
  selfRegistration: boolean;
  allowedEmailDomains: string[];
};

type Form = {
  displayName: string;
  logoUrl: string;
  brandColor: string;
  registrationForm: RegistrationForm;
  selfRegistration: boolean;
  domains: string;
};

const DEFAULT_COLOR = "#004B85";

const PRESETS = [
  { name: "Azul", color: "#004B85" },
  { name: "Verde", color: "#008452" },
  { name: "Rojo", color: "#D60019" },
  { name: "Turquesa", color: "#0F766E" },
  { name: "Violeta", color: "#7C3AED" },
  { name: "Ámbar", color: "#B45309" },
  { name: "Grafito", color: "#1F2937" },
];

const FORMS: { value: RegistrationForm; label: string; hint: string }[] = [
  { value: "BASIC", label: "Básico", hint: "Nombre, correo, teléfono y contraseña." },
  { value: "ACADEMIC", label: "Académico", hint: "Alumnos y funcionarios: RUT, carrera o cargo." },
];

function toForm(s: Settings): Form {
  return {
    displayName: s.displayName,
    logoUrl: s.logoUrl ?? "",
    brandColor: s.brandColor ?? "",
    registrationForm: s.registrationForm,
    selfRegistration: s.selfRegistration,
    domains: s.allowedEmailDomains.join(", "),
  };
}

function parseDomains(value: string) {
  return [...new Set(value.split(/[\s,;]+/).map((d) => d.trim().toLowerCase()).filter(Boolean))];
}

function validLogo(value: string) {
  return value.startsWith("/") || value.startsWith("https://");
}

export default function AdminSettings() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/organization")
      .then((r) => r.json())
      .then((d: { organization: Settings }) => {
        setSettings(d.organization);
        setForm(toForm(d.organization));
      });
  }, []);

  if (!settings || !form) {
    return (
      <div style={{ padding: 24, display: "grid", gap: 16 }}>
        <div className="skeleton" style={{ height: 260, borderRadius: 16 }} />
        <div className="skeleton" style={{ height: 220, borderRadius: 16 }} />
      </div>
    );
  }

  const color = form.brandColor.trim();
  const colorFormatOk = color === "" || HEX_COLOR.test(color);
  const colorReadable = color === "" || readableOnWhite(color);
  const logo = form.logoUrl.trim();
  const logoOk = logo === "" || validLogo(logo);
  const canSave = form.displayName.trim().length >= 2 && colorFormatOk && colorReadable && logoOk && !saving;
  const preview = orgTheme(HEX_COLOR.test(color) ? color : null);
  const link = `${window.location.origin}/o/${settings.slug}/registro`;

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    toast.success("Enlace copiado");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const res = await fetch("/api/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName.trim(),
          logoUrl: logo || null,
          brandColor: color ? color.toUpperCase() : null,
          registrationForm: form.registrationForm,
          selfRegistration: form.selfRegistration,
          allowedEmailDomains: parseDomains(form.domains),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.issues?.[0]?.message ?? data.error ?? "No se pudo guardar");
        return;
      }
      setSettings(data.organization);
      setForm(toForm(data.organization));
      toast.success("Cambios guardados");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} style={{ padding: 24, display: "grid", gap: 20, maxWidth: 980 }}>
      <div>
        <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24 }}>Configuración</h1>
        <p className="muted" style={{ fontSize: 13 }}>
          Cambia cómo se ve tu panel y cómo se registran tus usuarios.
        </p>
      </div>

      <Card title="Marca">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          <div style={{ display: "grid", gap: 14, alignContent: "start", minWidth: 0 }}>
            <div className="field">
              <label className="field-lbl" htmlFor="displayName">Nombre visible</label>
              <input
                id="displayName"
                className="input"
                maxLength={60}
                value={form.displayName}
                onChange={(e) => set("displayName", e.target.value)}
              />
              <span className="field-hint">Aparece en el menú, en tu página de registro y en el login.</span>
            </div>

            <div className="field">
              <label className="field-lbl" htmlFor="logoUrl">
                Logo <span className="muted">(opcional)</span>
              </label>
              <input
                id="logoUrl"
                className="input"
                placeholder="https://tu-sitio.cl/logo.png"
                value={form.logoUrl}
                onChange={(e) => set("logoUrl", e.target.value)}
              />
              {logoOk ? (
                <span className="field-hint">Dirección https de una imagen cuadrada. Si lo dejas vacío, se usan tus iniciales.</span>
              ) : (
                <span className="field-err">
                  <I name="alert" size={13} /> Usa una dirección que empiece con https://
                </span>
              )}
            </div>

            <div className="field">
              <span className="field-lbl">Color principal</span>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                {PRESETS.map((p) => {
                  const on = color.toUpperCase() === p.color;
                  return (
                    <button
                      key={p.color}
                      type="button"
                      title={p.name}
                      aria-label={`Color ${p.name}`}
                      aria-pressed={on}
                      onClick={() => set("brandColor", p.color)}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        background: p.color,
                        border: "2px solid var(--surface)",
                        boxShadow: on ? `0 0 0 2px ${p.color}` : "0 0 0 1px var(--line)",
                        cursor: "pointer",
                      }}
                    />
                  );
                })}
              </div>
              <div className="row" style={{ gap: 8, marginTop: 10 }}>
                <input
                  type="color"
                  aria-label="Elegir otro color"
                  value={HEX_COLOR.test(color) ? color : DEFAULT_COLOR}
                  onChange={(e) => set("brandColor", e.target.value.toUpperCase())}
                  style={{ width: 42, height: 38, padding: 2, border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)", cursor: "pointer", flex: "none" }}
                />
                <input
                  className="input mono"
                  aria-label="Código del color"
                  style={{ textTransform: "none", maxWidth: 140 }}
                  placeholder="Por defecto"
                  value={form.brandColor}
                  onChange={(e) => set("brandColor", e.target.value)}
                />
                {color && (
                  <button type="button" className="btn ghost" onClick={() => set("brandColor", "")}>
                    Usar el de S.I.G.T.E
                  </button>
                )}
              </div>
              {!colorFormatOk ? (
                <span className="field-err" style={{ marginTop: 6 }}>
                  <I name="alert" size={13} /> Usa el formato #RRGGBB, por ejemplo #004B85.
                </span>
              ) : !colorReadable ? (
                <span className="field-err" style={{ marginTop: 6 }}>
                  <I name="alert" size={13} /> Ese color es muy claro: el texto blanco de los botones no se leería.
                </span>
              ) : (
                <span className="field-hint" style={{ marginTop: 6 }}>Se usa en el menú, los botones y los enlaces.</span>
              )}
            </div>
          </div>

          <div style={{ minWidth: 0 }}>
            <span className="field-lbl">Vista previa</span>
            <div
              className={preview.className}
              style={{
                ...preview.style,
                marginTop: 6,
                display: "grid",
                gridTemplateColumns: "minmax(0, 190px) minmax(0, 1fr)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                overflow: "hidden",
                minHeight: 220,
              }}
            >
              <div style={{ background: "var(--accent-900)", color: "#fff", padding: "14px 12px", display: "grid", gap: 14, alignContent: "start" }}>
                <OrgBrand
                  name={form.displayName.trim() || settings.displayName}
                  legalName={settings.name}
                  logoUrl={logo && logoOk ? logo : null}
                  light
                />
                <div style={{ display: "grid", gap: 2, fontSize: 12.5 }}>
                  {["Panel", "Usuarios", "Vehículos"].map((item, i) => (
                    <span
                      key={item}
                      style={{
                        padding: "7px 9px",
                        borderRadius: 7,
                        background: i === 0 ? "rgba(255,255,255,.14)" : "transparent",
                        color: i === 0 ? "#fff" : "rgba(255,255,255,.78)",
                        fontWeight: i === 0 ? 600 : 400,
                      }}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ background: "var(--bg)", padding: 16, display: "grid", gap: 12, alignContent: "start", justifyItems: "start" }}>
                <span className="btn primary">
                  <I name="plus" size={16} /> Botón principal
                </span>
                <span className="btn secondary">Botón secundario</span>
                <span style={{ color: "var(--accent)", fontWeight: 600, fontSize: 13.5 }}>Un enlace</span>
                <span className="badge info">
                  <span className="dot" />
                  Etiqueta
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Registro de usuarios">
        <div style={{ display: "grid", gap: 16 }}>
          <div className="field">
            <span className="field-lbl">Enlace para tus usuarios</span>
            <div className="row" style={{ gap: 8 }}>
              <input className="input mono" style={{ textTransform: "none", flex: 1, minWidth: 0 }} readOnly value={link} aria-label="Enlace de registro" />
              <button type="button" className="btn secondary" onClick={copyLink}>
                Copiar
              </button>
            </div>
            <span className="field-hint">Compártelo con tus conductores para que creen su cuenta.</span>
          </div>

          <label className="row" style={{ gap: 12, cursor: "pointer" }}>
            <span className="switch">
              <input
                type="checkbox"
                checked={form.selfRegistration}
                onChange={(e) => set("selfRegistration", e.target.checked)}
              />
              <span className="track" />
              <span className="thumb" />
            </span>
            <span>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Registro abierto</span>
              <span className="muted" style={{ display: "block", fontSize: 12.5 }}>
                {form.selfRegistration
                  ? "Cualquiera con el enlace puede crear su cuenta."
                  : "Solo la administración crea las cuentas."}
              </span>
            </span>
          </label>

          <div className="field">
            <span className="field-lbl">Formulario de registro</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              {FORMS.map((f) => {
                const on = form.registrationForm === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set("registrationForm", f.value)}
                    style={{
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: `1.5px solid ${on ? "var(--accent)" : "var(--line)"}`,
                      background: on ? "var(--accent-050)" : "var(--surface)",
                      cursor: "pointer",
                      fontFamily: "var(--ff-body)",
                    }}
                  >
                    <span style={{ display: "block", fontWeight: 600, fontSize: 14, color: on ? "var(--accent-700)" : "var(--ink-900)" }}>
                      {f.label}
                    </span>
                    <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-500)", marginTop: 2 }}>{f.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="field">
            <label className="field-lbl" htmlFor="domains">Dominios de correo permitidos</label>
            <input
              id="domains"
              className="input"
              placeholder="organizacion.cl, alumnos.organizacion.cl"
              value={form.domains}
              onChange={(e) => set("domains", e.target.value)}
            />
            <span className="field-hint">Déjalo vacío para aceptar cualquier correo. Los subdominios también se aceptan.</span>
          </div>
        </div>
      </Card>

      <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="btn ghost" onClick={() => setForm(toForm(settings))} disabled={saving}>
          Deshacer cambios
        </button>
        <button type="submit" className="btn primary" disabled={!canSave}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
