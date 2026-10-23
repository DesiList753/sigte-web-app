"use client";

import { useEffect, useState } from "react";
import { Card, Plate, Badge } from "@/components/ui-system";
import { I } from "@/components/Icon";
import { INFRACTION_TYPE_LABEL } from "@/lib/design-data";
import { formatDate } from "@/lib/utils";

type Infraction = {
  id: string;
  type: string;
  description: string;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";
  createdAt: string;
  vehicle: { plate: string };
  guard: { name: string };
};

const STATUS_KIND: Record<Infraction["status"], "go" | "no" | "wait" | "neutral"> = {
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

export default function UserInfractions() {
  const [items, setItems] = useState<Infraction[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/infractions")
      .then((r) => r.json())
      .then((d) => setItems(d.infractions ?? []));
  }, []);

  async function acknowledge(id: string) {
    setBusyId(id);
    try {
      const r = await fetch(`/api/infractions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACKNOWLEDGED" }),
      });
      if (r.ok) {
        setItems((prev) =>
          prev.map((i) => (i.id === id ? { ...i, status: "ACKNOWLEDGED" } : i))
        );
      }
    } finally {
      setBusyId(null);
    }
  }

  const openCount = items.filter((i) => i.status === "OPEN").length;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <header>
        <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24 }}>Mis infracciones</h1>
        <p className="muted">Historial de fiscalización interna</p>
      </header>

      {openCount > 0 && (
        <div className="callout warn row" style={{ gap: 10 }}>
          <I name="shieldAlert" size={18} />
          <span>
            Tienes {openCount}{" "}
            {openCount === 1 ? "infracción abierta que requiere" : "infracciones abiertas que requieren"} tu atención.
          </span>
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {items.map((i) => (
          <Card key={i.id}>
            <div className="row between" style={{ alignItems: "flex-start", gap: 12 }}>
              <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    display: "grid",
                    placeItems: "center",
                    background: "var(--accent-050)",
                    color: "var(--accent-700)",
                    flexShrink: 0,
                  }}
                >
                  <I name="shieldAlert" size={20} />
                </span>
                <div>
                  <div className="row" style={{ gap: 8, alignItems: "center" }}>
                    <Plate size="sm">{i.vehicle.plate}</Plate>
                    <span className="muted">·</span>
                    <strong>{INFRACTION_TYPE_LABEL[i.type] ?? i.type}</strong>
                  </div>
                  <p style={{ marginTop: 6 }}>{i.description}</p>
                  <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                    Registrada por <span style={{ color: "var(--ink-900)" }}>{i.guard.name}</span>
                    {" · "}
                    <span className="mono">{formatDate(i.createdAt)}</span>
                  </p>
                </div>
              </div>
              <Badge kind={STATUS_KIND[i.status]}>{STATUS_LABEL[i.status]}</Badge>
            </div>
            {i.status === "OPEN" && (
              <div style={{ marginTop: 12 }}>
                <button
                  className="btn primary sm"
                  onClick={() => acknowledge(i.id)}
                  disabled={busyId === i.id}
                >
                  <I name="check" size={15} />
                  Reconocer
                </button>
              </div>
            )}
          </Card>
        ))}
        {items.length === 0 && (
          <Card>
            <div className="col center" style={{ padding: "48px 0", gap: 6, textAlign: "center" }}>
              <I name="shieldCheck" size={40} style={{ color: "var(--ok-600)" }} />
              <p style={{ fontWeight: 600 }}>Sin infracciones</p>
              <p className="muted">¡Bien hecho! Tu historial está limpio.</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
