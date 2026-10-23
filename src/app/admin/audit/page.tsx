"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui-system";
import { AuditTable, type AuditRow } from "@/components/AuditTable";

export default function AdminAudit() {
  const [logs, setLogs] = useState<AuditRow[] | null>(null);

  useEffect(() => {
    fetch("/api/audit")
      .then((r) => r.json())
      .then((data) => setLogs(data.logs ?? []));
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24 }}>Auditoría</h1>
      <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        Acciones importantes realizadas en tu organización
      </p>
      <Card>
        {logs === null ? (
          <p className="muted" style={{ padding: 24, textAlign: "center" }}>Cargando…</p>
        ) : (
          <AuditTable logs={logs} />
        )}
      </Card>
    </div>
  );
}
