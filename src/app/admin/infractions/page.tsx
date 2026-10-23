"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plate, Badge } from "@/components/ui-system";
import { I } from "@/components/Icon";
import { INFRACTION_TYPE_LABEL, type Estado } from "@/lib/design-data";
import { formatDate } from "@/lib/utils";

type Infraction = {
  id: string;
  type: string;
  description: string;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";
  createdAt: string;
  vehicle: { id: string; plate: string };
  user: { id: string; name: string; email: string } | null;
  guard: { id: string; name: string };
};

const STATUS_KIND: Record<Infraction["status"], Estado> = {
  OPEN: "no",
  ACKNOWLEDGED: "wait",
  RESOLVED: "go",
  DISMISSED: "neutral",
};

const STATUS_LABEL: Record<Infraction["status"], string> = {
  OPEN: "Abierta",
  ACKNOWLEDGED: "Notificada",
  RESOLVED: "Resuelta",
  DISMISSED: "Descartada",
};

const STATUS_OPTIONS: Infraction["status"][] = [
  "OPEN",
  "ACKNOWLEDGED",
  "RESOLVED",
  "DISMISSED",
];

export default function AdminInfractions() {
  const [items, setItems] = useState<Infraction[]>([]);

  async function load() {
    const r = await fetch("/api/infractions").then((r) => r.json());
    setItems(r.infractions ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: Infraction["status"]) {
    const r = await fetch(`/api/infractions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!r.ok) return toast.error("Error al actualizar");
    toast.success("Estado actualizado");
    load();
  }

  const openCount = items.filter((i) => i.status === "OPEN").length;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24 }}>Infracciones</h1>
      <p className="muted" style={{ marginTop: 4 }}>
        Gestión del ciclo de fiscalización interna
      </p>

      {openCount > 0 && (
        <div className="callout danger" style={{ marginTop: 16 }}>
          <I name="shieldAlert" size={18} />
          <span>
            Hay <strong>{openCount}</strong>{" "}
            {openCount === 1 ? "infracción abierta" : "infracciones abiertas"} pendientes de
            gestión.
          </span>
        </div>
      )}

      <div className="card" style={{ marginTop: 16, overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Patente</th>
              <th>Tipo</th>
              <th>Descripción</th>
              <th>Dueño</th>
              <th>Guardia</th>
              <th>Estado</th>
              <th style={{ width: 160 }}>Cambiar</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td className="mono muted">{formatDate(i.createdAt)}</td>
                <td>
                  <Plate size="sm">{i.vehicle.plate}</Plate>
                </td>
                <td>{INFRACTION_TYPE_LABEL[i.type] ?? i.type}</td>
                <td className="muted" style={{ maxWidth: 280 }}>
                  {i.description}
                </td>
                <td>{i.user?.name ?? "—"}</td>
                <td className="muted">{i.guard.name}</td>
                <td>
                  <Badge kind={STATUS_KIND[i.status]}>{STATUS_LABEL[i.status]}</Badge>
                </td>
                <td>
                  <select
                    className="select"
                    value={i.status}
                    aria-label={`Cambiar estado de la infracción de ${i.vehicle.plate}`}
                    onChange={(e) =>
                      setStatus(i.id, e.target.value as Infraction["status"])
                    }
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="muted" style={{ textAlign: "center", padding: "24px 0" }}>
                    Sin infracciones
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
