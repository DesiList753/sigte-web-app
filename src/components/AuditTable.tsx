"use client";

import { ACTION_LABEL, ENTITY_LABEL, formatDetail } from "@/lib/audit-labels";
import { formatDate } from "@/lib/utils";

export type AuditRow = {
  id: string;
  createdAt: string;
  actorName: string;
  action: string;
  entity: string;
  detail: unknown;
  organization?: { displayName: string } | null;
};

export function AuditTable({ logs, showOrganization }: { logs: AuditRow[]; showOrganization?: boolean }) {
  const columns = showOrganization ? 6 : 5;
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="table">
        <thead>
          <tr>
            <th>Fecha</th>
            {showOrganization && <th>Organización</th>}
            <th>Quién</th>
            <th>Acción</th>
            <th>Sobre</th>
            <th>Detalle</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td className="mono muted" style={{ whiteSpace: "nowrap", fontSize: 12.5 }}>
                {formatDate(l.createdAt)}
              </td>
              {showOrganization && <td>{l.organization?.displayName ?? "Plataforma"}</td>}
              <td>{l.actorName}</td>
              <td style={{ fontWeight: 600 }}>{ACTION_LABEL[l.action] ?? l.action}</td>
              <td>{ENTITY_LABEL[l.entity] ?? l.entity}</td>
              <td className="muted" style={{ fontSize: 12.5 }}>
                {formatDetail(l.detail) || "—"}
              </td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td colSpan={columns} className="muted" style={{ textAlign: "center", padding: 24 }}>
                Sin registros
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
