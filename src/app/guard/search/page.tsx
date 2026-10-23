"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, Plate, Badge } from "@/components/ui-system";
import { I } from "@/components/Icon";

type Vehicle = {
  id: string;
  plate: string;
  make: string | null;
  model: string | null;
  color: string | null;
  authorized: boolean;
  owner: {
    id: string;
    name: string;
    email: string;
    role: string;
    credentialId: string | null;
  };
  currentBlock: { id: string; name: string } | null;
};

function roleChip(role: string): string {
  const r = role.toUpperCase();
  if (r === "ADMIN") return "admin";
  if (r === "GUARD") return "guardia";
  return "funcionario";
}

function GuardSearchInner() {
  const sp = useSearchParams();
  const [scope, setScope] = useState<"inside" | "all">("inside");
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [results, setResults] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);

  // El topbar de PanelShell empuja /guard/search?q=...; reflejarlo en el input.
  useEffect(() => {
    const urlQ = sp.get("q");
    if (urlQ !== null) setQ(urlQ);
  }, [sp]);

  useEffect(() => {
    const t = setTimeout(() => {
      run();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, scope]);

  async function run() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (scope === "inside") params.set("inside", "true");
      const r = await fetch(`/api/vehicles?${params.toString()}`).then((r) => r.json());
      setResults(r.vehicles ?? []);
    } finally {
      setLoading(false);
    }
  }

  const SCOPES: { id: typeof scope; label: string; icon: string }[] = [
    { id: "inside", label: "En el estacionamiento ahora", icon: "eye" },
    { id: "all", label: "Todos los registrados", icon: "list" },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24 }}>Buscar vehículos</h1>
        <p className="muted" style={{ fontSize: 13 }}>
          Por patente, nombre del usuario, email o credencial
        </p>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {SCOPES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={"btn " + (scope === s.id ? "primary" : "ghost")}
              onClick={() => setScope(s.id)}
            >
              <I name={s.icon} size={16} />
              {s.label}
            </button>
          ))}
        </div>

        <div className="searchbox">
          <I name="search" size={17} />
          <input
            autoFocus
            className="input"
            placeholder={
              scope === "inside"
                ? "Patente o nombre del dueño..."
                : "Buscar en toda la base..."
            }
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </Card>

      <Card
        title={loading ? "Buscando..." : `${results.length} resultado${results.length === 1 ? "" : "s"}`}
      >
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          {scope === "inside"
            ? "Vehículos dentro en este momento"
            : "Cualquier patente del sistema"}
        </p>
        {results.length === 0 && !loading ? (
          <p className="muted" style={{ textAlign: "center", padding: 32 }}>
            {q ? "Sin coincidencias" : "Escribí algo para buscar…"}
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Patente</th>
                <th>Vehículo</th>
                <th>Propietario</th>
                <th>Rol</th>
                <th style={{ textAlign: "right" }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {results.map((v) => (
                <tr key={v.id}>
                  <td>
                    <Plate size="sm">{v.plate}</Plate>
                  </td>
                  <td className="muted" style={{ fontSize: 12.5 }}>
                    {[v.make, v.model].filter(Boolean).join(" ") || "Sin datos"}
                    {v.color ? ` · ${v.color}` : ""}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 8, alignItems: "center" }}>
                      <span className="avatar sm">
                        {v.owner.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>{v.owner.name}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {v.owner.email}
                          {v.owner.credentialId && ` · ${v.owner.credentialId}`}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={"chip-role " + roleChip(v.owner.role)}>{v.owner.role}</span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div className="col" style={{ gap: 4, alignItems: "flex-end" }}>
                      <Badge kind={v.authorized ? "go" : "no"}>
                        {v.authorized ? "Autorizado" : "Bloqueado"}
                      </Badge>
                      {v.currentBlock ? (
                        <Badge kind="info">{v.currentBlock.name}</Badge>
                      ) : (
                        <span className="muted" style={{ fontSize: 11 }}>Fuera</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

export default function GuardSearch() {
  return (
    <Suspense fallback={<p className="muted" style={{ padding: 24 }}>Cargando…</p>}>
      <GuardSearchInner />
    </Suspense>
  );
}
