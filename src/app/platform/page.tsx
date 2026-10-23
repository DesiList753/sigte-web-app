"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge, Card, Modal } from "@/components/ui-system";
import { I } from "@/components/Icon";
import { slugify } from "@/lib/slug";
import { formatDate } from "@/lib/utils";

type Usage = {
  users: number;
  guards: number;
  admins: number;
  blocks: number;
  vehicles: number;
  accessesThisMonth: number;
};

type Organization = {
  id: string;
  slug: string;
  name: string;
  displayName: string;
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
  plan: { id: string; code: string; name: string };
  usage: Usage;
};

type Plan = { id: string; code: string; name: string };

const EMPTY_FORM = {
  name: "",
  displayName: "",
  slug: "",
  planId: "",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
};

export default function PlatformOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[] | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch("/api/platform/organizations").then((r) => r.json()),
      fetch("/api/platform/plans").then((r) => r.json()),
    ]).then(([orgs, planList]) => {
      setOrganizations(orgs.organizations ?? []);
      setPlans(planList.plans ?? []);
    });
  }, [version]);

  function set<K extends keyof typeof EMPTY_FORM>(key: K, value: string) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "displayName" && !slugTouched) next.slug = slugify(value);
      return next;
    });
  }

  function closeNew() {
    setShowNew(false);
    setForm(EMPTY_FORM);
    setSlugTouched(false);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch("/api/platform/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          displayName: form.displayName,
          slug: form.slug,
          planId: form.planId || plans[0]?.id,
          admin: { name: form.adminName, email: form.adminEmail, password: form.adminPassword },
        }),
      });
      const data = await r.json();
      if (!r.ok) return toast.error(data.issues?.[0]?.message ?? data.error ?? "No se pudo crear");
      toast.success(`Organización ${data.organization.displayName} creada`);
      closeNew();
      setVersion((v) => v + 1);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div className="row between" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24 }}>Organizaciones</h1>
          <p className="muted" style={{ fontSize: 13 }}>
            Cuentas que usan S.I.G.T.E, con su plan y uso del mes
          </p>
        </div>
        <button className="btn primary" onClick={() => setShowNew(true)}>
          <I name="plus" size={18} />
          Nueva organización
        </button>
      </div>

      <Card>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Organización</th>
                <th>Plan</th>
                <th>Estado</th>
                <th style={{ textAlign: "right" }}>Usuarios</th>
                <th style={{ textAlign: "right" }}>Guardias</th>
                <th style={{ textAlign: "right" }}>Bloques</th>
                <th style={{ textAlign: "right" }}>Vehículos</th>
                <th style={{ textAlign: "right" }}>Accesos del mes</th>
                <th>Creada</th>
              </tr>
            </thead>
            <tbody>
              {organizations === null ? (
                <tr>
                  <td colSpan={9} className="muted" style={{ textAlign: "center", padding: 24 }}>
                    Cargando…
                  </td>
                </tr>
              ) : organizations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="muted" style={{ textAlign: "center", padding: 24 }}>
                    Sin organizaciones
                  </td>
                </tr>
              ) : (
                organizations.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/platform/organizations/${o.id}`} style={{ fontWeight: 600 }}>
                        {o.displayName}
                      </Link>
                      <div className="mono muted" style={{ fontSize: 12 }}>
                        /o/{o.slug}
                      </div>
                    </td>
                    <td>{o.plan.name}</td>
                    <td>
                      <Badge kind={o.status === "ACTIVE" ? "go" : "no"}>
                        {o.status === "ACTIVE" ? "Activa" : "Suspendida"}
                      </Badge>
                    </td>
                    <td className="mono" style={{ textAlign: "right" }}>{o.usage.users}</td>
                    <td className="mono" style={{ textAlign: "right" }}>{o.usage.guards}</td>
                    <td className="mono" style={{ textAlign: "right" }}>{o.usage.blocks}</td>
                    <td className="mono" style={{ textAlign: "right" }}>{o.usage.vehicles}</td>
                    <td className="mono" style={{ textAlign: "right" }}>{o.usage.accessesThisMonth}</td>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>
                      {formatDate(o.createdAt, { dateStyle: "medium", timeStyle: undefined })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showNew && (
        <Modal title="Nueva organización" onClose={closeNew} width={560}>
          <form onSubmit={create} style={{ display: "grid", gap: 14, marginTop: 14 }}>
            <div className="field">
              <label className="field-lbl" htmlFor="org-name">Nombre legal</label>
              <input
                id="org-name"
                className="input"
                required
                placeholder="Universidad Ejemplo, Sede Centro"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
            <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
              <div className="field" style={{ flex: 1 }}>
                <label className="field-lbl" htmlFor="org-display">Nombre visible</label>
                <input
                  id="org-display"
                  className="input"
                  required
                  placeholder="Ejemplo Centro"
                  value={form.displayName}
                  onChange={(e) => set("displayName", e.target.value)}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label className="field-lbl" htmlFor="org-slug">Slug</label>
                <input
                  id="org-slug"
                  className="input mono"
                  style={{ textTransform: "none" }}
                  required
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", e.target.value);
                  }}
                />
                <span className="field-hint">Enlace: /o/{form.slug || "slug"}</span>
              </div>
            </div>
            <div className="field">
              <label className="field-lbl" htmlFor="org-plan">Plan</label>
              <select
                id="org-plan"
                className="select"
                value={form.planId || plans[0]?.id || ""}
                onChange={(e) => set("planId", e.target.value)}
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="divider" />
            <p className="muted" style={{ fontSize: 13 }}>Primer administrador de la organización</p>
            <div className="field">
              <label className="field-lbl" htmlFor="admin-name">Nombre</label>
              <input
                id="admin-name"
                className="input"
                required
                value={form.adminName}
                onChange={(e) => set("adminName", e.target.value)}
              />
            </div>
            <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
              <div className="field" style={{ flex: 1 }}>
                <label className="field-lbl" htmlFor="admin-email">Correo</label>
                <input
                  id="admin-email"
                  className="input"
                  type="email"
                  required
                  value={form.adminEmail}
                  onChange={(e) => set("adminEmail", e.target.value)}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label className="field-lbl" htmlFor="admin-password">Contraseña inicial</label>
                <input
                  id="admin-password"
                  className="input"
                  type="password"
                  required
                  minLength={8}
                  value={form.adminPassword}
                  onChange={(e) => set("adminPassword", e.target.value)}
                />
              </div>
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button type="button" className="btn ghost" onClick={closeNew}>
                Cancelar
              </button>
              <button type="submit" className="btn primary" disabled={saving}>
                {saving ? "Creando…" : "Crear organización"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
