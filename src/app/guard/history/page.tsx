"use client";

import { useEffect, useState } from "react";
import { Card, Plate, DirTag } from "@/components/ui-system";
import { formatDate } from "@/lib/utils";

type Log = {
  id: string;
  method: string;
  direction: "IN" | "OUT";
  timestamp: string;
  vehicle: { plate: string; owner: { name: string } | null };
  block: { name: string } | null;
};

export default function GuardHistory() {
  const [logs, setLogs] = useState<Log[]>([]);
  useEffect(() => {
    fetch("/api/access?limit=100")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs ?? []));
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <div className="row between" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24 }}>Historial reciente</h1>
          <p className="muted" style={{ fontSize: 13 }}>
            Últimos 100 accesos
          </p>
        </div>
      </div>

      <Card>
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Patente</th>
              <th>Dueño</th>
              <th>Método</th>
              <th>Dirección</th>
              <th>Bloque</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="mono muted" style={{ fontSize: 12 }}>
                  {formatDate(l.timestamp)}
                </td>
                <td>
                  <Plate size="sm">{l.vehicle.plate}</Plate>
                </td>
                <td className="muted">{l.vehicle.owner?.name ?? "—"}</td>
                <td>
                  <span className="mono" style={{ fontSize: 12 }}>{l.method}</span>
                </td>
                <td>
                  <DirTag direccion={l.direction === "IN" ? "in" : "out"} />
                </td>
                <td className="muted">{l.block?.name ?? "—"}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 24 }} className="muted">
                  Sin registros
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
