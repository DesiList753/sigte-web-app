"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, Plate, Badge, Metric } from "@/components/ui-system";
import { I } from "@/components/Icon";
import { QrScanner } from "@/components/QrScanner";
import { useFeature } from "@/components/PlanContext";

type Vehicle = {
  id: string;
  plate: string;
  make: string | null;
  model: string | null;
  color: string | null;
  authorized: boolean;
  owner: { id: string; name: string; email: string; credentialId: string | null };
  currentBlock: { id: string; name: string } | null;
};
type Block = {
  id: string;
  name: string;
  capacity: number;
  occupied: number;
  free: number;
  isDefault: boolean;
};
type Totals = { inside: number; capacity: number; free: number; defaultBlockId: string | null };
type LookupResponse = { vehicle: Vehicle | null; openInfractions?: number; qrError?: "invalido" | "expirado" };

export default function GuardAccess() {
  const qrEnabled = useFeature("QR");
  const [mode, setMode] = useState<"plate" | "qr" | "uid">("plate");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<LookupResponse | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<string>(""); // "" = usar default
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    refreshParking();
  }, []);

  async function refreshParking() {
    const r = await fetch("/api/parking").then((r) => r.json());
    setBlocks(r.blocks ?? []);
    setTotals(r.totals ?? null);
  }

  async function lookup(value?: string) {
    const v = (value ?? query).trim();
    if (!v) return;
    const r = await fetch(
      `/api/access/lookup?${mode}=${encodeURIComponent(v)}`
    ).then((r) => r.json());
    setResult(r);
    if (r.qrError === "expirado") toast.error("QR expirado (válido por 5 minutos)");
    else if (r.qrError === "invalido") toast.error("QR inválido o falsificado");
    else if (!r.vehicle) toast.error("Vehículo no encontrado en el sistema");
  }

  function handleScan(text: string) {
    setScanning(false);
    setQuery(text);
    lookup(text);
  }

  async function register(direction: "IN" | "OUT") {
    if (!result?.vehicle) return;
    setBusy(true);
    try {
      const r = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: result.vehicle.id,
          method: mode === "plate" ? "PLATE" : mode === "qr" ? "QR" : "CARD",
          direction,
          blockId: direction === "IN" ? selectedBlock || undefined : undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast.error(data.error ?? "Error al registrar");
      } else {
        if (data.warning) toast.warning(data.warning);
        toast.success(direction === "IN" ? "Ingreso registrado" : "Salida registrada");
        setQuery("");
        setResult(null);
        refreshParking();
      }
    } finally {
      setBusy(false);
    }
  }

  const defaultBlock = blocks.find((b) => b.isDefault);
  const pctGlobal = totals && totals.capacity > 0
    ? Math.round((totals.inside / totals.capacity) * 100)
    : 0;

  const MODES: { id: typeof mode; label: string; icon: string }[] = [
    { id: "plate", label: "Patente", icon: "camera" },
    ...(qrEnabled ? [{ id: "qr" as const, label: "QR", icon: "qr" }] : []),
    { id: "uid", label: "U-Card", icon: "idcard" },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div className="row between" style={{ marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24 }}>Control de acceso</h1>
          <p className="muted" style={{ fontSize: 13 }}>
            Validación por patente, código QR o credencial
          </p>
        </div>
        <Link href="/guard/occupancy" className="btn ghost">
          <I name="eye" size={16} />
          Ver estacionamiento en vivo
        </Link>
      </div>

      {totals && (
        <div className="row" style={{ gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <Metric
              label="Vehículos dentro · tiempo real"
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

      <Card title="Identificar vehículo">
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
          Elige el método y escanea / ingresa el valor
        </p>

        <div className="row" style={{ gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={"btn " + (mode === m.id ? "primary" : "ghost")}
              onClick={() => {
                setMode(m.id);
                setResult(null);
                setQuery("");
                setScanning(false);
              }}
            >
              <I name={m.icon} size={16} />
              {m.label}
            </button>
          ))}
        </div>

        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <div className="searchbox" style={{ flex: 1, minWidth: 220 }}>
            <I name="search" size={17} />
            <input
              className="input mono"
              placeholder={
                mode === "plate"
                  ? "AABB12"
                  : mode === "qr"
                  ? "sigte:v1:..."
                  : "USR-2026-123"
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookup()}
            />
          </div>
          {mode === "qr" && (
            <button
              className={"btn " + (scanning ? "" : "ghost")}
              onClick={() => setScanning((s) => !s)}
            >
              <I name="scan" size={16} />
              {scanning ? "Detener" : "Escanear"}
            </button>
          )}
          <button className="btn primary" onClick={() => lookup()}>
            <I name="search" size={16} />
            Buscar
          </button>
        </div>

        {scanning && mode === "qr" && (
          <QrScanner onScan={handleScan} onClose={() => setScanning(false)} />
        )}

        {result?.vehicle && (
          <VehicleCard
            vehicle={result.vehicle}
            openInfractions={result.openInfractions ?? 0}
            blocks={blocks}
            defaultBlock={defaultBlock}
            selectedBlock={selectedBlock}
            onBlockChange={setSelectedBlock}
            busy={busy}
            onIn={() => register("IN")}
            onOut={() => register("OUT")}
          />
        )}
      </Card>
    </div>
  );
}

function VehicleCard({
  vehicle,
  openInfractions,
  blocks,
  defaultBlock,
  selectedBlock,
  onBlockChange,
  busy,
  onIn,
  onOut,
}: {
  vehicle: Vehicle;
  openInfractions: number;
  blocks: Block[];
  defaultBlock?: Block;
  selectedBlock: string;
  onBlockChange: (id: string) => void;
  busy: boolean;
  onIn: () => void;
  onOut: () => void;
}) {
  return (
    <Card pad="sm" style={{ marginTop: 16 }}>
      <div className="row between" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <Plate size="lg">{vehicle.plate}</Plate>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            {[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "—"}
            {vehicle.color ? ` · ${vehicle.color}` : ""}
          </p>
          <p style={{ fontSize: 13, marginTop: 8 }}>
            <span className="muted">Dueño: </span>
            <span style={{ fontWeight: 600 }}>{vehicle.owner.name}</span>
            {vehicle.owner.credentialId && (
              <span className="mono muted" style={{ marginLeft: 8, fontSize: 12 }}>
                ({vehicle.owner.credentialId})
              </span>
            )}
          </p>
        </div>
        <div className="row" style={{ gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <Badge kind={vehicle.authorized ? "go" : "no"}>
            {vehicle.authorized ? "AUTORIZADO" : "BLOQUEADO"}
          </Badge>
          {vehicle.currentBlock && <Badge kind="info">{vehicle.currentBlock.name}</Badge>}
          {openInfractions > 0 && (
            <Badge kind="wait">{openInfractions} infracción(es)</Badge>
          )}
        </div>
      </div>

      {!vehicle.currentBlock && (
        <div className="field" style={{ marginTop: 14 }}>
          <div className="row between" style={{ alignItems: "center" }}>
            <label className="field-lbl" htmlFor="bloque-asignar">Bloque a asignar (opcional)</label>
            {defaultBlock && (
              <Badge kind="info">Default: {defaultBlock.name}</Badge>
            )}
          </div>
          <select
            id="bloque-asignar"
            className="select"
            value={selectedBlock}
            onChange={(e) => onBlockChange(e.target.value)}
          >
            <option value="">Usar default ({defaultBlock?.name ?? "No definido"})</option>
            {blocks.map((b) => (
              <option key={b.id} value={b.id} disabled={b.free <= 0}>
                {b.isDefault ? "⭐ " : ""}
                {b.name} · {b.free}/{b.capacity} libres
              </option>
            ))}
          </select>
          <span className="field-hint">
            Si no eliges un bloque, el vehículo queda en{" "}
            {defaultBlock?.name ?? "el bloque default"} y lo puedes mover luego desde
            &quot;Estacionamiento en vivo&quot;.
          </span>
        </div>
      )}

      <div className="row" style={{ gap: 8, marginTop: 14 }}>
        <button
          className="btn primary lg"
          style={{ flex: 1 }}
          onClick={onIn}
          disabled={busy || !vehicle.authorized || !!vehicle.currentBlock}
        >
          <I name="login" size={18} />
          Registrar ingreso
        </button>
        <button
          className="btn lg"
          style={{ flex: 1 }}
          onClick={onOut}
          disabled={busy || !vehicle.currentBlock}
        >
          <I name="logout" size={18} />
          Registrar salida
        </button>
      </div>
    </Card>
  );
}
