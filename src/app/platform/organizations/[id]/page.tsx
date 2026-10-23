"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge, Card, Metric } from "@/components/ui-system";
import { I } from "@/components/Icon";
import { AuditTable, type AuditRow } from "@/components/AuditTable";
import { LIMIT_KEYS, PlanUsage, type LimitKey, type Limits } from "@/components/PlanUsage";
import { formatDate } from "@/lib/utils";

type Organization = {
  id: string;
  slug: string;
  name: string;
  displayName: string;
  logoUrl: string | null;
  brandColor: string | null;
  status: "ACTIVE" | "SUSPENDED";
  registrationForm: "BASIC" | "ACADEMIC";
  selfRegistration: boolean;
  allowedEmailDomains: string[];
  planId: string;
  plan: { id: string; code: string; name: string };
  admins: { id: string; name: string; email: string; active: boolean; createdAt: string }[];
  usage: {
    users: number;
    guards: number;
    admins: number;
    blocks: number;
    vehicles: number;
    accessesThisMonth: number;
  };
  limits: Limits;
};

type Plan = {
  id: string;
  name: string;
  maxUsers: number | null;
  maxGuards: number | null;
  maxBlocks: number | null;
  maxVehicles: number | null;
};

const PLAN_FIELD: Record<LimitKey, "maxUsers" | "maxGuards" | "maxBlocks" | "maxVehicles"> = {
  users: "maxUsers",
  guards: "maxGuards",
  blocks: "maxBlocks",
  vehicles: "maxVehicles",
};

const LIMIT_NOUN: Record<LimitKey, string> = {
  users: "usuarios",
  guards: "guardias",
  blocks: "bloques",
  vehicles: "vehículos",
};

type Form = {
  name: string;
  displayName: string;
  slug: string;
  logoUrl: string;
  brandColor: string;
  registrationForm: "BASIC" | "ACADEMIC";
  selfRegistration: boolean;
  allowedEmailDomains: string;
};

function toForm(o: Organization): Form {
  return {
    name: o.name,
    displayName: o.displayName,
    slug: o.slug,
    logoUrl: o.logoUrl ?? "",
    brandColor: o.brandColor ?? "",
    registrationForm: o.registrationForm,
    selfRegistration: o.selfRegistration,
    allowedEmailDomains: o.allowedEmailDomains.join(", "),
  };
}

export default function PlatformOrganizationDetail() {
  const { id } = useParams<{ id: string }>();
  const [org, setOrg] = useState<Organization | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState("");
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch(`/api/platform/organizations/${id}`).then(async (r) => (r.ok ? r.json() : null)),
      fetch("/api/platform/plans").then((r) => r.json()),
      fetch(`/api/platform/audit?organizationId=${id}&limit=20`).then((r) => r.json()),
    ]).then(([detail, planList, audit]) => {
      if (!detail) {
        setNotFound(true);
        return;
      }
      setOrg(detail.organization);
      setForm(toForm(detail.organization));
      setPlanId(detail.organization.planId);
      setPlans(planList.plans ?? []);
      setLogs(audit.logs ?? []);
    });
  }, [id, version]);

  async function patch(body: Record<string, unknown>, message: string) {
    const r = await fetch(`/api/platform/organizations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) return toast.error(data.issues?.[0]?.message ?? data.error ?? "No se pudo guardar");
    toast.success(message);
    setVersion((v) => v + 1);
  }

  function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    patch(
      {
        name: form.name,
        displayName: form.displayName,
        slug: form.slug,
        logoUrl: form.logoUrl.trim() || null,
        brandColor: form.brandColor.trim() || null,
        registrationForm: form.registrationForm,
        selfRegistration: form.selfRegistration,
        allowedEmailDomains: form.allowedEmailDomains
          .split(",")
          .map((d) => d.trim().toLowerCase())
          .filter(Boolean),
      },
      "Datos guardados"
    );
  }

  function toggleStatus() {
    if (!org) return;
    const suspend = org.status === "ACTIVE";
    const question = suspend
      ? `¿Suspender ${org.displayName}? Nadie de la organización podrá entrar hasta reactivarla.`
      : `¿Reactivar ${org.displayName}?`;
    if (!confirm(question)) return;
    patch({ status: suspend ? "SUSPENDED" : "ACTIVE" }, suspend ? "Organización suspendida" : "Organización reactivada");
  }

  if (notFound) {
    return (
      <div style={{ padding: 24 }}>
        <p className="muted">Organización no encontrada.</p>
        <Link href="/platform">Volver a organizaciones</Link>
      </div>
    );
  }

  if (!org || !form) {
    return (
      <div style={{ padding: 24, display: "grid", gap: 16 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 120, borderRadius: 16 }} />
        ))}
      </div>
    );
  }

  const u = org.usage;
  const selectedPlan = plans.find((p) => p.id === planId);
  const exceeded =
    selectedPlan && planId !== org.planId
      ? LIMIT_KEYS.filter((key) => {
          const max = selectedPlan[PLAN_FIELD[key]];
          return max !== null && org.limits[key].used > max;
        })
      : [];

  return (
    <div style={{ padding: 24, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 20 }}>
      <div>
        <Link href="/platform" className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13 }}>
          <I name="chevronLeft" size={16} /> Organizaciones
        </Link>
        <div className="row" style={{ gap: 12, marginTop: 8 }}>
          <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24 }}>{org.displayName}</h1>
          <Badge kind={org.status === "ACTIVE" ? "go" : "no"}>
            {org.status === "ACTIVE" ? "Activa" : "Suspendida"}
          </Badge>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          {org.name} · <span className="mono">/o/{org.slug}</span> · Plan {org.plan.name}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
        <Metric label="Usuarios" icon="users" value={u.users} />
        <Metric label="Guardias" icon="shieldCheck" value={u.guards} />
        <Metric label="Administradores" icon="userCheck" value={u.admins} />
        <Metric label="Bloques" icon="parking" value={u.blocks} />
        <Metric label="Vehículos" icon="car" value={u.vehicles} />
        <Metric label="Accesos" icon="history" value={u.accessesThisMonth} sub="este mes" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, alignItems: "start" }}>
        <Card title="Datos de la organización" style={{ minWidth: 0 }}>
          <form onSubmit={saveDetails} style={{ display: "grid", gap: 14 }}>
            <div className="field">
              <label className="field-lbl" htmlFor="name">Nombre legal</label>
              <input id="name" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-lbl" htmlFor="displayName">Nombre visible</label>
              <input id="displayName" className="input" required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-lbl" htmlFor="slug">Slug</label>
              <input id="slug" className="input mono" style={{ textTransform: "none" }} required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
              <span className="field-hint">Cambiarlo deja sin efecto los enlaces de registro ya compartidos.</span>
            </div>
            <div className="field">
              <label className="field-lbl" htmlFor="logoUrl">Logo (URL https o ruta del sitio)</label>
              <input id="logoUrl" className="input" placeholder="https://…" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-lbl" htmlFor="brandColor">Color de marca</label>
              <div className="row" style={{ gap: 8 }}>
                <span
                  aria-hidden
                  style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid var(--line)", background: form.brandColor || "transparent", flex: "none" }}
                />
                <input id="brandColor" className="input mono" style={{ textTransform: "none" }} placeholder="#004B85" value={form.brandColor} onChange={(e) => setForm({ ...form, brandColor: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label className="field-lbl" htmlFor="registrationForm">Formulario de registro</label>
              <select
                id="registrationForm"
                className="select"
                value={form.registrationForm}
                onChange={(e) => setForm({ ...form, registrationForm: e.target.value as Form["registrationForm"] })}
              >
                <option value="BASIC">Básico</option>
                <option value="ACADEMIC">Académico (alumnos y funcionarios)</option>
              </select>
            </div>
            <label className="row" style={{ gap: 8, fontSize: 14 }}>
              <input type="checkbox" checked={form.selfRegistration} onChange={(e) => setForm({ ...form, selfRegistration: e.target.checked })} />
              Permitir que los usuarios se registren solos
            </label>
            <div className="field">
              <label className="field-lbl" htmlFor="domains">Dominios de correo permitidos</label>
              <input id="domains" className="input" placeholder="organizacion.cl, alumnos.organizacion.cl" value={form.allowedEmailDomains} onChange={(e) => setForm({ ...form, allowedEmailDomains: e.target.value })} />
              <span className="field-hint">Déjalo vacío para aceptar cualquier correo.</span>
            </div>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button type="submit" className="btn primary">Guardar cambios</button>
            </div>
          </form>
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 20, minWidth: 0 }}>
          <Card title="Plan">
            <div className="row" style={{ gap: 8 }}>
              <select className="select" style={{ flex: 1 }} aria-label="Plan" value={planId} onChange={(e) => setPlanId(e.target.value)}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button
                className="btn secondary"
                disabled={planId === org.planId}
                onClick={() => patch({ planId }, "Plan actualizado")}
              >
                Cambiar plan
              </button>
            </div>
            {exceeded.length > 0 && selectedPlan && (
              <div className="callout warn" style={{ marginTop: 12, fontSize: 13 }}>
                Con {selectedPlan.name} la organización queda sobre el límite de{" "}
                {exceeded
                  .map((key) => `${LIMIT_NOUN[key]} (${org.limits[key].used} de ${selectedPlan[PLAN_FIELD[key]]})`)
                  .join(", ")}
                . Conserva lo que ya tiene, pero no podrá crear más.
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <PlanUsage limits={org.limits} />
            </div>
          </Card>

          <Card title="Estado">
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              {org.status === "ACTIVE"
                ? "La organización funciona con normalidad."
                : "Nadie de la organización puede entrar. Sus datos se conservan."}
            </p>
            <button className={"btn " + (org.status === "ACTIVE" ? "danger" : "ok")} onClick={toggleStatus}>
              {org.status === "ACTIVE" ? "Suspender organización" : "Reactivar organización"}
            </button>
          </Card>

          <Card title="Administradores">
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th>Estado</th>
                    <th>Desde</th>
                  </tr>
                </thead>
                <tbody>
                  {org.admins.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>{a.name}</td>
                      <td className="muted">{a.email}</td>
                      <td>
                        <Badge kind={a.active ? "go" : "neutral"}>{a.active ? "Activo" : "Inactivo"}</Badge>
                      </td>
                      <td className="muted" style={{ whiteSpace: "nowrap" }}>
                        {formatDate(a.createdAt, { dateStyle: "medium", timeStyle: undefined })}
                      </td>
                    </tr>
                  ))}
                  {org.admins.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted" style={{ textAlign: "center", padding: 16 }}>
                        Sin administradores
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      <Card title="Actividad reciente">
        <AuditTable logs={logs} />
      </Card>
    </div>
  );
}
