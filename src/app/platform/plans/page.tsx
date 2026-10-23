"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge, Card, Modal } from "@/components/ui-system";
import { I } from "@/components/Icon";
import { slugify } from "@/lib/slug";

type Feature = "QR" | "INFRACTIONS" | "REPORTS";

type Plan = {
  id: string;
  code: string;
  name: string;
  maxUsers: number | null;
  maxGuards: number | null;
  maxBlocks: number | null;
  maxVehicles: number | null;
  features: Feature[];
  _count: { organizations: number };
};

type LimitField = "maxUsers" | "maxGuards" | "maxBlocks" | "maxVehicles";

const LIMITS: { key: LimitField; label: string }[] = [
  { key: "maxUsers", label: "Usuarios" },
  { key: "maxGuards", label: "Guardias" },
  { key: "maxBlocks", label: "Bloques" },
  { key: "maxVehicles", label: "Vehículos" },
];

const FEATURES: { key: Feature; label: string }[] = [
  { key: "QR", label: "QR" },
  { key: "INFRACTIONS", label: "Infracciones" },
  { key: "REPORTS", label: "Reportes" },
];

type Form = { code: string; name: string; features: Feature[] } & Record<LimitField, string>;

const EMPTY_FORM: Form = {
  code: "",
  name: "",
  maxUsers: "",
  maxGuards: "",
  maxBlocks: "",
  maxVehicles: "",
  features: ["QR"],
};

function toForm(p: Plan): Form {
  return {
    code: p.code,
    name: p.name,
    maxUsers: p.maxUsers?.toString() ?? "",
    maxGuards: p.maxGuards?.toString() ?? "",
    maxBlocks: p.maxBlocks?.toString() ?? "",
    maxVehicles: p.maxVehicles?.toString() ?? "",
    features: p.features,
  };
}

export default function PlatformPlans() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<Plan | "new" | null>(null);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/platform/plans")
      .then((r) => r.json())
      .then((data) => setPlans(data.plans ?? []));
  }, [version]);

  function open(plan: Plan | "new") {
    setEditing(plan);
    setForm(plan === "new" ? EMPTY_FORM : toForm(plan));
  }

  function toggleFeature(feature: Feature) {
    setForm((f) => ({
      ...f,
      features: f.features.includes(feature) ? f.features.filter((x) => x !== feature) : [...f.features, feature],
    }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const limits = Object.fromEntries(
        LIMITS.map(({ key }) => [key, form[key].trim() === "" ? null : Number(form[key])])
      );
      const isNew = editing === "new";
      const r = await fetch(isNew ? "/api/platform/plans" : `/api/platform/plans/${editing.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isNew ? { code: form.code } : {}),
          name: form.name,
          ...limits,
          features: form.features,
        }),
      });
      const data = await r.json();
      if (!r.ok) return toast.error(data.issues?.[0]?.message ?? data.error ?? "No se pudo guardar");
      toast.success(isNew ? "Plan creado" : "Plan actualizado");
      setEditing(null);
      setVersion((v) => v + 1);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div className="row between" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24 }}>Planes</h1>
          <p className="muted" style={{ fontSize: 13 }}>
            Límites y funciones de cada plan. Los cambios aplican de inmediato a sus organizaciones.
          </p>
        </div>
        <button className="btn primary" onClick={() => open("new")}>
          <I name="plus" size={18} />
          Nuevo plan
        </button>
      </div>

      <Card>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Plan</th>
                {LIMITS.map((l) => (
                  <th key={l.key} style={{ textAlign: "right" }}>{l.label}</th>
                ))}
                <th>Funciones</th>
                <th style={{ textAlign: "right" }}>Organizaciones</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {plans === null ? (
                <tr>
                  <td colSpan={8} className="muted" style={{ textAlign: "center", padding: 24 }}>Cargando…</td>
                </tr>
              ) : (
                plans.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div className="mono muted" style={{ fontSize: 12 }}>{p.code}</div>
                    </td>
                    {LIMITS.map((l) => (
                      <td key={l.key} className="mono" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {p[l.key] ?? (
                          <span className="muted" style={{ fontFamily: "var(--ff-body)", fontSize: 12.5 }}>Sin límite</span>
                        )}
                      </td>
                    ))}
                    <td>
                      <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                        {FEATURES.filter((f) => p.features.includes(f.key)).map((f) => (
                          <Badge key={f.key} kind="info">{f.label}</Badge>
                        ))}
                      </span>
                    </td>
                    <td className="mono" style={{ textAlign: "right" }}>{p._count.organizations}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn ghost icon" title={`Editar ${p.name}`} onClick={() => open(p)}>
                        <I name="pencil" size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && (
        <Modal title={editing === "new" ? "Nuevo plan" : `Editar plan ${editing.name}`} onClose={() => setEditing(null)} width={520}>
          <form onSubmit={save} style={{ display: "grid", gap: 14, marginTop: 14 }}>
            <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
              <div className="field" style={{ flex: 1 }}>
                <label className="field-lbl" htmlFor="plan-name">Nombre</label>
                <input
                  id="plan-name"
                  className="input"
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      name: e.target.value,
                      code: editing === "new" ? slugify(e.target.value) : f.code,
                    }))
                  }
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label className="field-lbl" htmlFor="plan-code">Código</label>
                <input
                  id="plan-code"
                  className="input mono"
                  style={{ textTransform: "none" }}
                  required
                  disabled={editing !== "new"}
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              {LIMITS.map((l) => (
                <div className="field" key={l.key}>
                  <label className="field-lbl" htmlFor={`plan-${l.key}`}>Máximo de {l.label.toLowerCase()}</label>
                  <input
                    id={`plan-${l.key}`}
                    className="input mono"
                    type="number"
                    min={1}
                    placeholder="Sin límite"
                    value={form[l.key]}
                    onChange={(e) => setForm((f) => ({ ...f, [l.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="field">
              <span className="field-lbl">Funciones incluidas</span>
              <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
                {FEATURES.map((f) => (
                  <label key={f.key} className="row" style={{ gap: 6, fontSize: 14 }}>
                    <input type="checkbox" checked={form.features.includes(f.key)} onChange={() => toggleFeature(f.key)} />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button type="submit" className="btn primary" disabled={saving}>
                {saving ? "Guardando…" : "Guardar plan"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
