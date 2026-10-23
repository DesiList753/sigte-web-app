"use client";

import { useEffect, useState } from "react";
import { Card, Badge, Plate, DirTag } from "@/components/ui-system";
import { I } from "@/components/Icon";
import { formatDate } from "@/lib/utils";
import { useFeature } from "@/components/PlanContext";

type Log = {
  id: string;
  method: "PLATE" | "QR" | "CARD" | "MANUAL";
  direction: "IN" | "OUT";
  timestamp: string;
  authorized: boolean;
  note: string | null;
  vehicle: { id: string; plate: string; owner: { id: string; name: string } | null };
  guard: { id: string; name: string } | null;
  block: { id: string; name: string } | null;
};

const methodIcon: Record<Log["method"], string> = {
  PLATE: "camera",
  QR: "qr",
  CARD: "idcard",
  MANUAL: "idcard",
};

export default function AdminAccess() {
  const reports = useFeature("REPORTS");
  const [logs, setLogs] = useState<Log[]>([]);
  useEffect(() => {
    fetch("/api/access?limit=200")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs ?? []));
  }, []);

  function exportCsv() {
    window.open("/api/access?limit=5000&format=csv", "_blank");
  }

  return (
    <div style={{ padding: 24 }}>
      <div className="row between" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24 }}>Historial de accesos</h1>
          <p className="muted" style={{ fontSize: 13 }}>
            Registro completo de entradas y salidas
          </p>
        </div>
        {reports && (
          <button className="btn ghost" onClick={exportCsv}>
            <I name="download" size={16} />
            Exportar CSV
          </button>
        )}
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
              <th>Guardia</th>
              <th>Estado</th>
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
                  <span className="row" style={{ gap: 6, alignItems: "center" }}>
                    <I name={methodIcon[l.method]} size={14} />
                    <span className="mono" style={{ fontSize: 12 }}>{l.method}</span>
                  </span>
                </td>
                <td>
                  <DirTag direccion={l.direction === "IN" ? "in" : "out"} />
                </td>
                <td className="muted">{l.block?.name ?? "—"}</td>
                <td className="muted">{l.guard?.name ?? "—"}</td>
                <td>
                  <Badge kind={l.authorized ? "go" : "no"}>
                    {l.authorized ? "Autorizado" : "Rechazado"}
                  </Badge>
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: 24 }} className="muted">
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
