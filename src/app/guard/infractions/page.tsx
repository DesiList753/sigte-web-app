"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, Modal, Badge, Plate } from "@/components/ui-system";
import { I } from "@/components/Icon";
import { INFRACTION_TYPE_LABEL, type Estado } from "@/lib/design-data";
import { formatDate } from "@/lib/utils";

const TYPES = Object.entries(INFRACTION_TYPE_LABEL).map(([k, l]) => ({ k, l }));

const STATUS: Record<string, { kind: Estado; label: string }> = {
  OPEN: { kind: "no", label: "Abierta" },
  ACKNOWLEDGED: { kind: "wait", label: "Reconocida" },
  RESOLVED: { kind: "go", label: "Resuelta" },
  DISMISSED: { kind: "neutral", label: "Descartada" },
};

type Infraction = {
  id: string;
  type: string;
  description: string;
  status: string;
  createdAt: string;
  vehicle: { plate: string };
  user: { name: string } | null;
};

export default function GuardInfractions() {
  const [items, setItems] = useState<Infraction[]>([]);
  const [form, setForm] = useState({ plate: "", type: "OTHER", description: "" });
  const [open, setOpen] = useState(false);

  async function load() {
    const r = await fetch("/api/infractions").then((r) => r.json());
    setItems(r.infractions ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/infractions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await r.json();
    if (!r.ok) return toast.error(data.error ?? "Error");
    toast.success("Infracción registrada");
    setForm({ plate: "", type: "OTHER", description: "" });
    setOpen(false);
    load();
  }

  return (
    <div style={{ padding: 24 }}>
      <div className="row between" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24 }}>Infracciones</h1>
          <p className="muted" style={{ fontSize: 13 }}>
            Fiscalización digital interna
          </p>
        </div>
        <button className="btn primary" onClick={() => setOpen(true)}>
          <I name="plus" size={16} />
          Nueva infracción
        </button>
      </div>

      <Card title="Mis últimos registros">
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Patente</th>
              <th>Tipo</th>
              <th>Descripción</th>
              <th>Dueño</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td className="mono muted" style={{ fontSize: 12 }}>
                  {formatDate(i.createdAt)}
                </td>
                <td>
                  <Plate size="sm">{i.vehicle.plate}</Plate>
                </td>
                <td>
                  <span style={{ fontSize: 12 }}>{INFRACTION_TYPE_LABEL[i.type] ?? i.type}</span>
                </td>
                <td className="muted" style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {i.description}
                </td>
                <td className="muted">{i.user?.name ?? "—"}</td>
                <td>
                  <Badge kind={STATUS[i.status]?.kind ?? "neutral"}>
                    {STATUS[i.status]?.label ?? i.status}
                  </Badge>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 24 }} className="muted">
                  Sin registros
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {open && (
        <Modal title="Nueva infracción" onClose={() => setOpen(false)} width={520}>
          <div className="callout" style={{ marginBottom: 14 }}>
            <I name="shieldAlert" size={16} />
            Se notificará automáticamente al dueño del vehículo
          </div>
          <form onSubmit={submit} className="col" style={{ gap: 14 }}>
            <div className="field">
              <label className="field-lbl" htmlFor="p">Patente</label>
              <input
                id="p"
                required
                className="input mono"
                style={{ textTransform: "uppercase" }}
                placeholder="AABB12"
                value={form.plate}
                onChange={(e) => setForm({ ...form, plate: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field-lbl" htmlFor="t">Tipo</label>
              <select
                id="t"
                className="select"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {TYPES.map((t) => (
                  <option key={t.k} value={t.k}>
                    {t.l}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-lbl" htmlFor="d">Descripción</label>
              <textarea
                id="d"
                required
                minLength={3}
                className="textarea"
                style={{ minHeight: 90 }}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn primary">
                <I name="check" size={16} />
                Registrar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
