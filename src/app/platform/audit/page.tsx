"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui-system";
import { AuditTable, type AuditRow } from "@/components/AuditTable";

type Organization = { id: string; displayName: string };

export default function PlatformAudit() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [logs, setLogs] = useState<AuditRow[] | null>(null);

  useEffect(() => {
    fetch("/api/platform/organizations")
      .then((r) => r.json())
      .then((data) => setOrganizations(data.organizations ?? []));
  }, []);

  useEffect(() => {
    const query = organizationId ? `?organizationId=${organizationId}&limit=200` : "?limit=200";
    fetch(`/api/platform/audit${query}`)
      .then((r) => r.json())
      .then((data) => setLogs(data.logs ?? []));
  }, [organizationId]);

  return (
    <div style={{ padding: 24 }}>
      <div className="row between" style={{ marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24 }}>Auditoría</h1>
          <p className="muted" style={{ fontSize: 13 }}>
            Acciones importantes de todas las organizaciones
          </p>
        </div>
        <select
          className="select"
          style={{ minWidth: 240, width: "auto" }}
          aria-label="Filtrar por organización"
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
        >
          <option value="">Todas las organizaciones</option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.displayName}
            </option>
          ))}
        </select>
      </div>
      <Card>
        {logs === null ? (
          <p className="muted" style={{ padding: 24, textAlign: "center" }}>Cargando…</p>
        ) : (
          <AuditTable logs={logs} showOrganization />
        )}
      </Card>
    </div>
  );
}
