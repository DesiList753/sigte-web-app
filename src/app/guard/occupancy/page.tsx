"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, Modal, Plate, Badge, LotGrid, Metric } from "@/components/ui-system";
import { I } from "@/components/Icon";
import { lotLevel, type Lot } from "@/lib/design-data";
import { fetchWithSession } from "@/lib/session-fetch";

type Block = {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  occupied: number;
  free: number;
  isDefault: boolean;
};

type Totals = {
  inside: number;
  capacity: number;
  free: number;
  defaultBlockId: string | null;
};

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

export default function GuardLive() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [ts, setTs] = useState(Date.now());
  const [selected, setSelected] = useState<Vehicle | null>(null);

  async function loadAll() {
    const [p, v] = await Promise.all([
      fetchWithSession<{ blocks?: Block[]; totals?: Totals }>("/api/parking"),
      fetchWithSession<{ vehicles?: Vehicle[] }>("/api/vehicles?inside=true"),
    ]);
    if (!p || !v) return;
    setBlocks(p.blocks ?? []);
    setTotals(p.totals ?? null);
    setVehicles(v.vehicles ?? []);
    setTs(Date.now());
  }

  useEffect(() => {
    loadAll();
    const i = setInterval(loadAll, 5000);
    return () => clearInterval(i);
  }, []);

  const filtered = useMemo(() => {
    let list = vehicles;
    if (activeBlockId !== "ALL") {
      list = list.filter((v) => v.currentBlock?.id === activeBlockId);
    }
    if (search.trim()) {
      const q = search.toUpperCase();
      list = list.filter(
        (v) =>
          v.plate.includes(q) ||
          v.owner.name.toUpperCase().includes(q) ||
          (v.owner.credentialId ?? "").toUpperCase().includes(q) ||
          v.owner.email.toUpperCase().includes(q)
      );
    }
    return list;
  }, [vehicles, activeBlockId, search]);

  async function moveVehicle(v: Vehicle, blockId: string) {
    const r = await fetch(`/api/vehicles/${v.id}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockId }),
    });
    const data = await r.json();
    if (!r.ok) return toast.error(data.error ?? "Error");
    toast.success(`${v.plate} movido: ${data.from} → ${data.to}`);
    setSelected(null);
    loadAll();
  }

  async function registerExit(v: Vehicle) {
    if (!confirm(`¿Registrar SALIDA de ${v.plate}?`)) return;
    const r = await fetch("/api/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleId: v.id,
        method: "MANUAL",
        direction: "OUT",
      }),
    });
    const data = await r.json();
    if (!r.ok) return toast.error(data.error ?? "Error");
    toast.success(`${v.plate} salió del estacionamiento`);
    setSelected(null);
    loadAll();
  }

  const activeBlock = blocks.find((b) => b.id === activeBlockId) ?? null;
  const pctGlobal = totals && totals.capacity > 0
    ? Math.round((totals.inside / totals.capacity) * 100)
    : 0;

  // Mapear bloques → Lot[] para la grilla (semáforo).
  const lots: Lot[] = blocks.map((b) => ({
    id: b.id,
    nombre: b.name,
    ocup: b.occupied,
    cap: b.capacity,
    ...lotLevel(b.occupied, b.capacity),
  }));

  return (
    <div style={{ padding: 24 }}>
      <div className="row between" style={{ marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24 }}>Estacionamiento en vivo</h1>
          <p className="muted" style={{ fontSize: 13 }}>
            Vehículos dentro, agrupados por bloque
          </p>
        </div>
        <Badge kind="info">
          Actualizado {new Date(ts).toLocaleTimeString()}
        </Badge>
      </div>

      {totals && (
        <div className="row" style={{ gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <Metric
              label="Cuenta general · tiempo real"
              icon="parking"
              value={totals.inside}
              sub={`de ${totals.capacity} · ${pctGlobal}% ocupación`}
            />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <Metric label="Cupos libres" icon="check" value={totals.free} sub="disponibles ahora" />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <Metric label="Capacidad total" icon="barrier" value={totals.capacity} sub="suma de bloques" />
          </div>
        </div>
      )}

      <Card title="Ocupación por bloque" style={{ marginBottom: 16 }}>
        {lots.length === 0 ? (
          <div className="muted" style={{ textAlign: "center", padding: 24 }}>Sin bloques</div>
        ) : (
          <LotGrid cols={3} lots={lots} />
        )}
      </Card>

      <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button
          className={"btn " + (activeBlockId === "ALL" ? "primary" : "ghost")}
          onClick={() => setActiveBlockId("ALL")}
        >
          Todos · {vehicles.length}
        </button>
        {blocks.map((b) => (
          <button
            key={b.id}
            className={"btn " + (activeBlockId === b.id ? "primary" : "ghost")}
            onClick={() => setActiveBlockId(b.id)}
          >
            {b.isDefault ? "⭐ " : ""}
            {b.name} · {b.occupied}
            {b.capacity > 0 ? `/${b.capacity}` : ""}
          </button>
        ))}
      </div>

      <Card
        title={
          activeBlockId === "ALL"
            ? "Todos los vehículos dentro"
            : activeBlock?.isDefault
            ? `${activeBlock.name} · Sin asignar a un bloque específico`
            : activeBlock?.name ?? "—"
        }
        action={
          <div className="searchbox" style={{ width: 240, maxWidth: "100%" }}>
            <I name="search" size={17} />
            <input
              className="input"
              placeholder="Patente o nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        }
      >
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          {filtered.length} vehículo{filtered.length === 1 ? "" : "s"}
          {search ? ` · filtrado por "${search}"` : ""}
        </p>
        {filtered.length === 0 ? (
          <div className="muted" style={{ textAlign: "center", padding: 40 }}>
            <I name="car" size={28} />
            <p style={{ marginTop: 8 }}>No hay vehículos en esta vista.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Patente</th>
                <th>Dueño</th>
                <th>Bloque</th>
                <th style={{ textAlign: "right" }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id} style={{ cursor: "pointer" }} onClick={() => setSelected(v)}>
                  <td>
                    <Plate size="sm">{v.plate}</Plate>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{v.owner.name}</div>
                    {v.owner.credentialId && (
                      <div className="mono muted" style={{ fontSize: 12 }}>{v.owner.credentialId}</div>
                    )}
                  </td>
                  <td>
                    {v.currentBlock ? <Badge kind="info">{v.currentBlock.name}</Badge> : <span className="muted">—</span>}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Badge kind={v.authorized ? "go" : "no"}>
                      {v.authorized ? "Autorizado" : "Bloqueado"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {selected && (
        <VehicleDialog
          vehicle={selected}
          blocks={blocks}
          onClose={() => setSelected(null)}
          onMove={(blockId) => selected && moveVehicle(selected, blockId)}
          onExit={() => selected && registerExit(selected)}
        />
      )}
    </div>
  );
}

function VehicleDialog({
  vehicle,
  blocks,
  onClose,
  onMove,
  onExit,
}: {
  vehicle: Vehicle;
  blocks: Block[];
  onClose: () => void;
  onMove: (blockId: string) => void;
  onExit: () => void;
}) {
  const [target, setTarget] = useState<string>("");
  useEffect(() => {
    setTarget("");
  }, [vehicle]);

  return (
    <Modal title="Detalle del vehículo" onClose={onClose}>
      <div style={{ marginBottom: 12 }}>
        <Plate size="lg">{vehicle.plate}</Plate>
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          {[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "—"}
          {vehicle.color ? ` · ${vehicle.color}` : ""}
        </div>
      </div>

      <Card pad="sm" style={{ marginBottom: 10 }}>
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <I name="user" size={16} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{vehicle.owner.name}</div>
            <div className="muted" style={{ fontSize: 12 }}>{vehicle.owner.email}</div>
          </div>
          <Badge kind="info">{vehicle.owner.role}</Badge>
        </div>
        <div className="row between" style={{ fontSize: 13, marginTop: 8 }}>
          <span className="muted">Credencial</span>
          <span className="mono">{vehicle.owner.credentialId ?? "—"}</span>
        </div>
        <div className="row between" style={{ fontSize: 13, marginTop: 6 }}>
          <span className="muted">Bloque actual</span>
          <Badge kind="info">{vehicle.currentBlock?.name ?? "—"}</Badge>
        </div>
        <div className="row between" style={{ fontSize: 13, marginTop: 6 }}>
          <span className="muted">Autorización</span>
          <Badge kind={vehicle.authorized ? "go" : "no"}>
            {vehicle.authorized ? "Autorizado" : "Bloqueado"}
          </Badge>
        </div>
      </Card>

      <div className="field" style={{ marginBottom: 12 }}>
        <div className="row between" style={{ alignItems: "center" }}>
          <label className="field-lbl" htmlFor="corregir-bloque">Corregir bloque asignado</label>
          <Badge kind="info">Actual: {vehicle.currentBlock?.name ?? "—"}</Badge>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <select id="corregir-bloque" className="select" style={{ flex: 1 }} value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Seleccionar nuevo bloque…</option>
            {blocks
              .filter((b) => b.id !== vehicle.currentBlock?.id)
              .map((b) => (
                <option key={b.id} value={b.id} disabled={b.free <= 0}>
                  {b.name} · {b.free}/{b.capacity} libres
                </option>
              ))}
          </select>
          <button className="btn" onClick={() => target && onMove(target)} disabled={!target}>
            <I name="arrowRight" size={16} />
            Reasignar
          </button>
        </div>
        <span className="field-hint">
          Reasignar solo mueve el vehículo de bloque; no registra entrada ni salida adicional.
        </span>
      </div>

      <div className="row between">
        <button className="btn danger" onClick={onExit}>
          <I name="logout" size={16} />
          Registrar salida
        </button>
        <button className="btn ghost" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  );
}
