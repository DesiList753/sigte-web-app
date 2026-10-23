"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, Modal, Plate, Badge, LotGrid } from "@/components/ui-system";
import { I } from "@/components/Icon";
import { lotLevel, type Lot } from "@/lib/design-data";

type Block = {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  occupied: number;
  free: number;
  isDefault: boolean;
};

type Totals = { inside: number; capacity: number; free: number; defaultBlockId: string | null };

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

export default function AdminParking() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [form, setForm] = useState({ name: "", description: "", capacity: 10 });
  const [editingName, setEditingName] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const savingRef = useRef(false);
  const cancelRef = useRef(false);

  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [blockVehicles, setBlockVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleDetail, setVehicleDetail] = useState<Vehicle | null>(null);
  const [moveTarget, setMoveTarget] = useState<Record<string, string>>({});

  async function load() {
    const r = await fetch("/api/parking").then((r) => r.json());
    setBlocks(r.blocks ?? []);
    setTotals(r.totals ?? null);
  }

  async function loadBlockVehicles(blockId: string) {
    setLoadingVehicles(true);
    try {
      const r = await fetch(`/api/vehicles?blockId=${blockId}`);
      const data = await r.json();
      setBlockVehicles(data.vehicles ?? []);
    } finally {
      setLoadingVehicles(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openBlock(b: Block) {
    setSelectedBlock(b);
    setVehicleSearch("");
    setMoveTarget({});
    setBlockVehicles([]);
    loadBlockVehicles(b.id);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setSelectedBlock(null);
    setVehicleDetail(null);
  }

  async function moveVehicle(vehicle: Vehicle, blockId: string) {
    const r = await fetch(`/api/vehicles/${vehicle.id}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockId }),
    });
    const data = await r.json();
    if (!r.ok) return toast.error(data.error ?? "Error al mover");
    toast.success(`${vehicle.plate} → ${data.to}`);
    setBlockVehicles((prev) => prev.filter((v) => v.id !== vehicle.id));
    setMoveTarget((prev) => { const n = { ...prev }; delete n[vehicle.id]; return n; });
    setVehicleDetail(null);
    load();
  }

  async function registerExit(vehicle: Vehicle) {
    if (!confirm(`¿Registrar SALIDA de ${vehicle.plate}?`)) return;
    const r = await fetch("/api/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleId: vehicle.id, method: "MANUAL", direction: "OUT" }),
    });
    const data = await r.json();
    if (!r.ok) return toast.error(data.error ?? "Error");
    toast.success(`${vehicle.plate} salió del estacionamiento`);
    setBlockVehicles((prev) => prev.filter((v) => v.id !== vehicle.id));
    setVehicleDetail(null);
    load();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/parking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, description: form.description || undefined, capacity: Number(form.capacity) }),
    });
    const data = await r.json();
    if (!r.ok) return toast.error(data.error ?? "Error");
    toast.success("Bloque creado");
    setForm({ name: "", description: "", capacity: 10 });
    load();
  }

  async function setDefault(b: Block) {
    const r = await fetch(`/api/parking/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    if (!r.ok) return toast.error("Error");
    toast.success(`${b.name} es ahora el bloque por defecto`);
    load();
  }

  async function rename(b: Block) {
    if (cancelRef.current) { cancelRef.current = false; return; }   // cancelado con Escape
    if (savingRef.current) return;                                   // ya se está guardando (blur tras Enter)
    if (!newName.trim() || newName === b.name) { setEditingName(null); return; }
    savingRef.current = true;
    try {
      const r = await fetch(`/api/parking/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!r.ok) { const e = await r.json(); toast.error(e.error ?? "Error"); return; }  // mantener la edición abierta
      toast.success("Nombre actualizado");
      setEditingName(null);
      load();
    } finally {
      // limpiar tras el blur que sigue al desmontaje
      setTimeout(() => { savingRef.current = false; }, 0);
    }
  }

  async function remove(b: Block) {
    if (!confirm(`¿Eliminar ${b.name}?`)) return;
    const r = await fetch(`/api/parking/${b.id}`, { method: "DELETE" });
    const data = await r.json();
    if (!r.ok) return toast.error(data.error ?? "Error");
    toast.success("Bloque eliminado");
    load();
  }

  const filteredVehicles = useMemo(() => {
    if (!vehicleSearch.trim()) return blockVehicles;
    const q = vehicleSearch.toUpperCase();
    return blockVehicles.filter(
      (v) =>
        v.plate.includes(q) ||
        v.owner.name.toUpperCase().includes(q) ||
        (v.owner.credentialId ?? "").toUpperCase().includes(q) ||
        v.owner.email.toUpperCase().includes(q)
    );
  }, [blockVehicles, vehicleSearch]);

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
      <div className="row between" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24 }}>Bloques de estacionamiento</h1>
          <p className="muted" style={{ fontSize: 13 }}>
            Configuración de zonas y capacidad. Haz click en un bloque para gestionar los vehículos dentro.
          </p>
        </div>
      </div>

      {totals && (
        <div className="row" style={{ gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <Card pad="sm" style={{ flex: 1, minWidth: 160 }}>
            <div className="muted" style={{ fontSize: 12 }}>Ocupación general</div>
            <div className="mono" style={{ fontSize: 28, fontWeight: 700 }}>
              {totals.inside}
              <span className="muted" style={{ fontSize: 16 }}> / {totals.capacity}</span>
            </div>
          </Card>
          <Card pad="sm" style={{ flex: 1, minWidth: 160 }}>
            <div className="muted" style={{ fontSize: 12 }}>Cupos libres</div>
            <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: "var(--ok-700)" }}>
              {totals.free}
            </div>
          </Card>
          <Card pad="sm" style={{ flex: 1, minWidth: 160 }}>
            <div className="muted" style={{ fontSize: 12 }}>Bloques activos</div>
            <div className="mono" style={{ fontSize: 28, fontWeight: 700 }}>{blocks.length}</div>
          </Card>
        </div>
      )}

      <Card title="Nuevo bloque" style={{ marginBottom: 16 }}>
        <form onSubmit={create} className="row" style={{ gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field" style={{ flex: 2, minWidth: 200 }}>
            <label className="field-lbl" htmlFor="n">Nombre</label>
            <input id="n" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 120 }}>
            <label className="field-lbl" htmlFor="c">Capacidad</label>
            <input id="c" className="input" type="number" min={1} required value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
          </div>
          <div className="field" style={{ flex: 2, minWidth: 200 }}>
            <label className="field-lbl" htmlFor="d">Descripción</label>
            <input id="d" className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <button type="submit" className="btn primary">
            <I name="plus" size={16} />Crear
          </button>
        </form>
      </Card>

      <Card title="Bloques" style={{ marginBottom: 16 }}>
        {lots.length === 0 ? (
          <div className="muted" style={{ textAlign: "center", padding: 24 }}>Sin bloques</div>
        ) : (
          <LotGrid cols={3} lots={lots} />
        )}
      </Card>

      {/* Lista de bloques con acciones */}
      <Card title="Gestión de bloques">
        <table className="table">
          <thead>
            <tr>
              <th>Bloque</th>
              <th>Ocupación</th>
              <th>Estado</th>
              <th style={{ textAlign: "right" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((b) => {
              const lvl = lotLevel(b.occupied, b.capacity);
              const kind = lvl.level === "full" || lvl.level === "high" ? "no" : lvl.level === "mid" ? "wait" : "go";
              return (
                <tr key={b.id} style={{ cursor: "pointer" }} onClick={() => openBlock(b)}>
                  <td>
                    <div className="row" style={{ gap: 8, alignItems: "center" }}>
                      <I name="parking" size={16} />
                      {editingName === b.id ? (
                        <input
                          autoFocus
                          className="input"
                          style={{ height: 30, maxWidth: 200 }}
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onBlur={() => rename(b)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); rename(b); }
                            if (e.key === "Escape") { cancelRef.current = true; setEditingName(null); }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          style={{ fontWeight: 600 }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingName(b.id);
                            setNewName(b.name);
                          }}
                          title="Doble click para renombrar"
                        >
                          {b.name}
                        </span>
                      )}
                      {b.isDefault && <Badge kind="info">Por defecto</Badge>}
                    </div>
                    {b.description && (
                      <div className="muted" style={{ fontSize: 12 }}>{b.description}</div>
                    )}
                  </td>
                  <td className="mono">
                    {b.occupied} / {b.capacity}{" "}
                    <span className="muted">({lvl.pct}%)</span>
                  </td>
                  <td>
                    <Badge kind={kind}>{lvl.estado}</Badge>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <span className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                      <button className="btn ghost icon" title="Ver vehículos" onClick={() => openBlock(b)}>
                        <I name="car" size={16} />
                      </button>
                      {!b.isDefault && (
                        <button className="btn ghost icon" title="Marcar como por defecto" onClick={() => setDefault(b)}>
                          <I name="check" size={16} />
                        </button>
                      )}
                      <button
                        className="btn ghost icon"
                        title="Renombrar"
                        onClick={() => { setEditingName(b.id); setNewName(b.name); }}
                      >
                        <I name="pencil" size={16} />
                      </button>
                      <button className="btn danger icon" title="Eliminar" onClick={() => remove(b)}>
                        <I name="trash" size={16} />
                      </button>
                    </span>
                  </td>
                </tr>
              );
            })}
            {blocks.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: 24 }} className="muted">
                  Sin bloques
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Modal: vehículos del bloque seleccionado */}
      {sheetOpen && selectedBlock && (
        <Modal
          title={`${selectedBlock.name} · ${selectedBlock.occupied}/${selectedBlock.capacity} cupos`}
          width={640}
          onClose={closeSheet}
        >
          <div className="row between" style={{ marginBottom: 12 }}>
            <div className="searchbox" style={{ flex: 1 }}>
              <I name="search" size={17} />
              <input
                className="input"
                placeholder="Patente, nombre o credencial..."
                value={vehicleSearch}
                onChange={(e) => setVehicleSearch(e.target.value)}
              />
            </div>
            <button
              className="btn ghost icon"
              title="Actualizar lista"
              onClick={() => loadBlockVehicles(selectedBlock.id)}
              style={{ marginLeft: 8 }}
            >
              <I name="refresh" size={16} />
            </button>
          </div>

          {loadingVehicles ? (
            <div className="muted" style={{ textAlign: "center", padding: 24 }}>Cargando…</div>
          ) : filteredVehicles.length === 0 ? (
            <div className="muted" style={{ textAlign: "center", padding: 24 }}>
              {vehicleSearch ? `Sin resultados para "${vehicleSearch}"` : "No hay vehículos en este bloque"}
            </div>
          ) : (
            <div className="col" style={{ gap: 10 }}>
              {filteredVehicles.map((v) => (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  blocks={blocks.filter((b) => b.id !== v.currentBlock?.id)}
                  moveTarget={moveTarget[v.id] ?? ""}
                  onMoveTargetChange={(bid) =>
                    setMoveTarget((prev) => ({ ...prev, [v.id]: bid }))
                  }
                  onMove={() => moveTarget[v.id] && moveVehicle(v, moveTarget[v.id])}
                  onExit={() => registerExit(v)}
                  onInfo={() => setVehicleDetail(v)}
                />
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Modal: detalle completo de vehículo + dueño */}
      {vehicleDetail && (
        <VehicleDetailDialog
          vehicle={vehicleDetail}
          blocks={blocks.filter((b) => b.id !== vehicleDetail?.currentBlock?.id)}
          onClose={() => setVehicleDetail(null)}
          onMove={(blockId) => vehicleDetail && moveVehicle(vehicleDetail, blockId)}
          onExit={() => vehicleDetail && registerExit(vehicleDetail)}
        />
      )}
    </div>
  );
}

// VehicleCard dentro del Modal

function VehicleCard({
  vehicle,
  blocks,
  moveTarget,
  onMoveTargetChange,
  onMove,
  onExit,
  onInfo,
}: {
  vehicle: Vehicle;
  blocks: Block[];
  moveTarget: string;
  onMoveTargetChange: (id: string) => void;
  onMove: () => void;
  onExit: () => void;
  onInfo: () => void;
}) {
  return (
    <Card pad="sm">
      <div className="row between" style={{ alignItems: "flex-start", gap: 10 }}>
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <Plate size="sm">{vehicle.plate}</Plate>
          {!vehicle.authorized && <Badge kind="no">No autorizado</Badge>}
        </div>
        <span className="row" style={{ gap: 6 }}>
          <button className="btn ghost icon" title="Ver información completa" onClick={onInfo}>
            <I name="eye" size={16} />
          </button>
          <button className="btn danger icon" title="Registrar salida" onClick={onExit}>
            <I name="logout" size={16} />
          </button>
        </span>
      </div>

      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
        {[vehicle.make, vehicle.model, vehicle.color].filter(Boolean).join(" · ") || "Sin datos del vehículo"}
      </div>

      <div className="row" style={{ gap: 8, marginTop: 8, alignItems: "center" }}>
        <I name="user" size={16} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{vehicle.owner.name}</div>
          <div className="muted" style={{ fontSize: 12 }}>{vehicle.owner.email}</div>
        </div>
        {vehicle.owner.credentialId && (
          <span className="mono muted" style={{ fontSize: 12 }}>{vehicle.owner.credentialId}</span>
        )}
      </div>

      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <select
          className="select"
          style={{ flex: 1 }}
          value={moveTarget}
          aria-label="Reasignar bloque"
          onChange={(e) => onMoveTargetChange(e.target.value)}
        >
          <option value="">Reasignar bloque…</option>
          {blocks.map((b) => (
            <option key={b.id} value={b.id} disabled={b.free <= 0}>
              {b.name} · {b.free}/{b.capacity} libres
            </option>
          ))}
        </select>
        <button className="btn" onClick={onMove} disabled={!moveTarget}>
          <I name="arrowRight" size={16} />Mover
        </button>
      </div>
    </Card>
  );
}

// Modal de detalle completo

function VehicleDetailDialog({
  vehicle,
  blocks,
  onClose,
  onMove,
  onExit,
}: {
  vehicle: Vehicle | null;
  blocks: Block[];
  onClose: () => void;
  onMove: (blockId: string) => void;
  onExit: () => void;
}) {
  const [target, setTarget] = useState("");
  useEffect(() => { setTarget(""); }, [vehicle]);

  if (!vehicle) return null;

  return (
    <Modal title="Detalle del vehículo" onClose={onClose}>
      <div style={{ marginBottom: 12 }}>
        <Plate size="lg">{vehicle.plate}</Plate>
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          {[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Sin datos del vehículo"}
          {vehicle.color ? ` · ${vehicle.color}` : ""}
        </div>
      </div>

      <Card pad="sm" style={{ marginBottom: 10 }}>
        <div className="field-lbl" style={{ marginBottom: 8 }}>Datos del vehículo</div>
        <InfoRow label="Patente" value={<span className="mono" style={{ fontWeight: 700 }}>{vehicle.plate}</span>} />
        <InfoRow label="Marca / Modelo" value={[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "—"} />
        <InfoRow label="Color" value={vehicle.color ?? "—"} />
        <InfoRow
          label="Autorización"
          value={<Badge kind={vehicle.authorized ? "go" : "no"}>{vehicle.authorized ? "Autorizado" : "Bloqueado"}</Badge>}
        />
        <InfoRow
          label="Bloque actual"
          value={<Badge kind="info">{vehicle.currentBlock?.name ?? "—"}</Badge>}
        />
      </Card>

      <Card pad="sm" style={{ marginBottom: 10 }}>
        <div className="field-lbl" style={{ marginBottom: 8 }}>Datos del propietario</div>
        <InfoRow label="Nombre" value={<span style={{ fontWeight: 600 }}>{vehicle.owner.name}</span>} />
        <InfoRow label="Email" value={<span className="muted">{vehicle.owner.email}</span>} />
        <InfoRow
          label="Credencial"
          value={vehicle.owner.credentialId
            ? <span className="mono">{vehicle.owner.credentialId}</span>
            : <span className="muted">—</span>}
        />
        <InfoRow label="Rol" value={<Badge kind="info">{vehicle.owner.role}</Badge>} />
      </Card>

      <div className="field" style={{ marginBottom: 12 }}>
        <label className="field-lbl" htmlFor="reasignar-bloque">Reasignar bloque</label>
        <div className="row" style={{ gap: 8 }}>
          <select id="reasignar-bloque" className="select" style={{ flex: 1 }} value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Seleccionar nuevo bloque…</option>
            {blocks.map((b) => (
              <option key={b.id} value={b.id} disabled={b.free <= 0}>
                {b.name} · {b.free}/{b.capacity} libres
              </option>
            ))}
          </select>
          <button className="btn" onClick={() => target && onMove(target)} disabled={!target}>
            <I name="arrowRight" size={16} />Mover
          </button>
        </div>
      </div>

      <div className="row between">
        <button className="btn danger" onClick={onExit}>
          <I name="logout" size={16} />Registrar salida
        </button>
        <button className="btn ghost" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="row between" style={{ fontSize: 13, padding: "3px 0" }}>
      <span className="muted">{label}</span>
      <span style={{ textAlign: "right" }}>{value}</span>
    </div>
  );
}
