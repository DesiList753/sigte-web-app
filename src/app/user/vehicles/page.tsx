"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, Modal, Plate, Badge } from "@/components/ui-system";
import { I } from "@/components/Icon";

type Vehicle = {
  id: string;
  plate: string;
  make: string | null;
  model: string | null;
  color: string | null;
  authorized: boolean;
  currentBlock: { id: string; name: string } | null;
};

export default function UserVehicles() {
  const [items, setItems] = useState<Vehicle[]>([]);
  const [form, setForm] = useState({ plate: "", make: "", model: "", color: "" });
  const [open, setOpen] = useState(false);

  async function load() {
    const r = await fetch("/api/vehicles").then((r) => r.json());
    setItems(r.vehicles ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plate: form.plate,
        make: form.make || undefined,
        model: form.model || undefined,
        color: form.color || undefined,
      }),
    });
    const data = await r.json();
    if (!r.ok) return toast.error(data.error ?? "Error");
    toast.success("Vehículo registrado");
    setForm({ plate: "", make: "", model: "", color: "" });
    setOpen(false);
    load();
  }

  async function remove(v: Vehicle) {
    if (!confirm(`¿Eliminar ${v.plate}?`)) return;
    const r = await fetch(`/api/vehicles/${v.id}`, { method: "DELETE" });
    if (!r.ok) return toast.error("No se pudo eliminar");
    toast.success("Vehículo eliminado");
    load();
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="row between" style={{ alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24 }}>Mis vehículos</h1>
          <p className="muted" style={{ fontSize: 13 }}>
            Patentes autorizadas para ingresar
          </p>
        </div>
        <button className="btn primary" onClick={() => setOpen(true)}>
          <I name="plus" size={16} />
          Registrar vehículo
        </button>
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {items.map((v) => (
          <Card key={v.id}>
            <div className="row between" style={{ alignItems: "flex-start", gap: 10 }}>
              <div className="row" style={{ gap: 12, alignItems: "center" }}>
                <Plate size="lg">{v.plate}</Plate>
              </div>
              <button className="btn danger icon" title="Eliminar" onClick={() => remove(v)}>
                <I name="trash" size={16} />
              </button>
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
              {[v.make, v.model].filter(Boolean).join(" ") || "Sin datos"}
              {v.color ? ` · ${v.color}` : ""}
            </div>
            <div className="row" style={{ gap: 6, marginTop: 12, flexWrap: "wrap" }}>
              <Badge kind={v.authorized ? "go" : "no"}>
                {v.authorized ? "Autorizado" : "Bloqueado"}
              </Badge>
              {v.currentBlock && <Badge kind="info">Dentro: {v.currentBlock.name}</Badge>}
            </div>
          </Card>
        ))}
        {items.length === 0 && (
          <p className="muted">Aún no registraste vehículos.</p>
        )}
      </div>

      {open && (
        <Modal title="Registrar vehículo" onClose={() => setOpen(false)}>
          <form onSubmit={create} className="col" style={{ gap: 14 }}>
            <div className="field">
              <label className="field-lbl" htmlFor="p">Patente *</label>
              <input
                id="p"
                required
                className="input mono"
                style={{ textTransform: "uppercase" }}
                placeholder="AABB12"
                value={form.plate}
                onChange={(e) => setForm({ ...form, plate: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field-lbl" htmlFor="mk">Marca</label>
              <input
                id="mk"
                className="input"
                value={form.make}
                onChange={(e) => setForm({ ...form, make: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field-lbl" htmlFor="md">Modelo</label>
              <input
                id="md"
                className="input"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field-lbl" htmlFor="cl">Color</label>
              <input
                id="cl"
                className="input"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
            </div>
            <div className="row between">
              <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn primary">
                <I name="plus" size={16} />
                Registrar vehículo
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
