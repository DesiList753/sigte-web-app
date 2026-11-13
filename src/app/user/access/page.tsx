"use client";

import { useEffect, useState } from "react";
import { Card, Plate, DirTag } from "@/components/ui-system";
import { I } from "@/components/Icon";
import { formatDate } from "@/lib/utils";

type Log = {
  id: string;
  method: "PLATE" | "QR" | "CARD" | "MANUAL";
  direction: "IN" | "OUT";
  timestamp: string;
  authorized: boolean;
  note: string | null;
  vehicle: { id: string; plate: string };
  guard: { id: string; name: string } | null;
  block: { id: string; name: string } | null;
};

const methodIcon: Record<Log["method"], string> = {
  PLATE: "camera",
  QR: "qr",
  CARD: "idcard",
  MANUAL: "idcard",
};

export default function UserAccess() {
  const [logs, setLogs] = useState<Log[]>([]);
  useEffect(() => {
    fetch("/api/access")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs ?? []));
  }, []);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <header>
        <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24 }}>Mis accesos</h1>
        <p className="muted">Historial de ingresos y salidas de tus vehículos</p>
      </header>

      <Card className="user-access-card">
        <table className="table responsive-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Patente</th>
              <th>Método</th>
              <th>Dirección</th>
              <th>Bloque</th>
              <th>Guardia</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="mono muted" style={{ fontSize: 12 }} data-label="Fecha">
                  {formatDate(l.timestamp)}
                </td>
                <td data-label="Patente">
                  <Plate size="sm">{l.vehicle.plate}</Plate>
                </td>
                <td data-label="Método">
                  <span className="row" style={{ gap: 6, alignItems: "center" }}>
                    <I name={methodIcon[l.method]} size={14} />
                    <span className="mono" style={{ fontSize: 12 }}>{l.method}</span>
                  </span>
                </td>
                <td data-label="Dirección">
                  <DirTag direccion={l.direction === "IN" ? "in" : "out"} />
                </td>
                <td className="muted" data-label="Bloque">{l.block?.name ?? "—"}</td>
                <td className="muted" data-label="Guardia">{l.guard?.name ?? "—"}</td>
                <td data-label="Estado">
                  <span style={{ color: l.authorized ? "var(--ok-600)" : "var(--no-600)", fontWeight: 600 }}>
                    {l.authorized ? "Autorizado" : "Rechazado"}
                  </span>
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 24 }} className="muted">
                  Sin registros de acceso
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
