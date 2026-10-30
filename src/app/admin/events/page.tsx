"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, Modal, Badge, Metric } from "@/components/ui-system";
import { I } from "@/components/Icon";
import { notifyEventsUpdated } from "@/components/NotificationsBadge";
import { formatDate } from "@/lib/utils";

type EventKind = "EVENT" | "EMERGENCY" | "MAINTENANCE" | "NOTICE";
type EventAudience = "ALL" | "USERS" | "GUARDS" | "AFFECTED_VEHICLES";
type EventPhase = "ACTIVE" | "SCHEDULED" | "ENDED" | "CANCELLED";

type BlockOption = {
  id: string;
  name: string;
  capacity: number;
  occupied: number;
  free: number;
  active: boolean;
  entryAllowed: boolean;
  isDefault: boolean;
};

type EventRow = {
  id: string;
  title: string;
  description: string;
  kind: EventKind;
  status: "ACTIVE" | "ENDED" | "CANCELLED";
  phase: EventPhase;
  disableEntry: boolean;
  showBanner: boolean;
  audience: EventAudience;
  startsAt: string;
  endsAt: string | null;
  endedAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
  blocks: { id: string; name: string; released: boolean }[];
  notifiedCount: number;
};

const KIND_OPTIONS: {
  id: EventKind;
  label: string;
  hint: string;
  icon: string;
  badge: "no" | "wait" | "info";
}[] = [
  {
    id: "EVENT",
    label: "Evento",
    hint: "Exposición, feria, ceremonia o reserva de estacionamientos",
    icon: "calendar",
    badge: "wait",
  },
  {
    id: "EMERGENCY",
    label: "Urgencia",
    hint: "Incidente o contingencia con cierre o alerta inmediata",
    icon: "shieldAlert",
    badge: "no",
  },
  {
    id: "MAINTENANCE",
    label: "Mantención",
    hint: "Obras, demarcación o trabajos técnicos en sectores",
    icon: "barrier",
    badge: "wait",
  },
  {
    id: "NOTICE",
    label: "Aviso general",
    hint: "Comunicado informativo para usuarios o guardias",
    icon: "megaphone",
    badge: "info",
  },
];

const AUDIENCE_OPTIONS: { id: EventAudience; label: string }[] = [
  { id: "ALL", label: "Toda la organización (conductores, guardias y admin)" },
  { id: "USERS", label: "Solo conductores" },
  { id: "GUARDS", label: "Solo guardias" },
  { id: "AFFECTED_VEHICLES", label: "Dueños con vehículos actualmente dentro de los bloques afectados" },
];

const PHASE_BADGE: Record<EventPhase, { kind: "go" | "wait" | "neutral" | "no"; label: string }> = {
  ACTIVE: { kind: "no", label: "En curso" },
  SCHEDULED: { kind: "wait", label: "Programado" },
  ENDED: { kind: "neutral", label: "Finalizado" },
  CANCELLED: { kind: "neutral", label: "Cancelado" },
};

function toLocalDatetimeInput(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [blocks, setBlocks] = useState<BlockOption[]>([]);
  const [tab, setTab] = useState<"CURRENT" | "HISTORY">("CURRENT");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [finishing, setFinishing] = useState<EventRow | null>(null);
  const [notifyOnFinish, setNotifyOnFinish] = useState(true);
  const [blockAction, setBlockAction] = useState<{ ev: EventRow; block: EventRow["blocks"][number] } | null>(null);
  const [notifyBlockAction, setNotifyBlockAction] = useState(true);
  const [busy, setBusy] = useState(false);

  const [kind, setKind] = useState<EventKind>("EVENT");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [disableEntry, setDisableEntry] = useState(true);
  const [scheduleMode, setScheduleMode] = useState<"NOW" | "SCHEDULED">("NOW");
  const [startsAtLocal, setStartsAtLocal] = useState("");
  const [endsAtLocal, setEndsAtLocal] = useState("");
  const [showBanner, setShowBanner] = useState(true);
  const [notify, setNotify] = useState(true);
  const [audience, setAudience] = useState<EventAudience>("ALL");

  const load = useCallback(async () => {
    const [evRes, pkRes] = await Promise.all([
      fetch("/api/events").then((r) => r.json()),
      fetch("/api/parking").then((r) => r.json()),
    ]);
    setEvents(evRes.events ?? []);
    setBlocks(pkRes.blocks ?? []);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  function openCreate(presetKind: EventKind = "EVENT") {
    const now = new Date();
    const inFourHours = new Date(now.getTime() + 4 * 3600_000);
    setEditing(null);
    setKind(presetKind);
    setTitle("");
    setDescription("");
    setSelectedBlockIds([]);
    setDisableEntry(presetKind !== "NOTICE");
    setScheduleMode(presetKind === "EVENT" ? "SCHEDULED" : "NOW");
    setStartsAtLocal(toLocalDatetimeInput(now));
    setEndsAtLocal(toLocalDatetimeInput(inFourHours));
    setShowBanner(true);
    setNotify(true);
    setAudience("ALL");
    setModalOpen(true);
  }

  function openEdit(ev: EventRow) {
    setEditing(ev);
    setKind(ev.kind);
    setTitle(ev.title);
    setDescription(ev.description);
    setSelectedBlockIds(ev.blocks.map((b) => b.id));
    setDisableEntry(ev.disableEntry);
    const hasWindow = Boolean(ev.endsAt) || ev.phase === "SCHEDULED";
    setScheduleMode(hasWindow ? "SCHEDULED" : "NOW");
    setStartsAtLocal(toLocalDatetimeInput(ev.startsAt));
    setEndsAtLocal(
      ev.endsAt
        ? toLocalDatetimeInput(ev.endsAt)
        : toLocalDatetimeInput(new Date(Date.now() + 4 * 3600_000))
    );
    setShowBanner(ev.showBanner);
    setNotify(false);
    setAudience(ev.audience);
    setModalOpen(true);
  }

  function toggleBlock(id: string) {
    setSelectedBlockIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    if (audience === "AFFECTED_VEHICLES" && selectedBlockIds.length === 0) {
      toast.error("Selecciona al menos un bloque para notificar a vehículos afectados");
      return;
    }

    const startsAtIso =
      scheduleMode === "SCHEDULED" && startsAtLocal
        ? new Date(startsAtLocal).toISOString()
        : undefined;
    const endsAtIso =
      scheduleMode === "SCHEDULED" && endsAtLocal
        ? new Date(endsAtLocal).toISOString()
        : null;

    setBusy(true);
    try {
      if (editing) {
        const r = await fetch(`/api/events/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description,
            kind,
            blockIds: selectedBlockIds,
            disableEntry: selectedBlockIds.length > 0 ? disableEntry : false,
            showBanner,
            audience,
            ...(startsAtIso ? { startsAt: startsAtIso } : {}),
            endsAt: endsAtIso,
            notifyUpdate: notify,
          }),
        });
        const data = await r.json();
        if (!r.ok) {
          toast.error(data.error ?? "No se pudo actualizar el evento");
          return;
        }
        toast.success(
          data.notifiedCount > 0
            ? `Evento actualizado · ${data.notifiedCount} cuenta(s) notificada(s)`
            : "Evento actualizado"
        );
      } else {
        const r = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description,
            kind,
            blockIds: selectedBlockIds,
            disableEntry: selectedBlockIds.length > 0 ? disableEntry : false,
            showBanner,
            startsAt: startsAtIso,
            endsAt: endsAtIso,
            notify,
            audience,
          }),
        });
        const data = await r.json();
        if (!r.ok) {
          toast.error(data.error ?? "No se pudo crear el evento");
          return;
        }
        toast.success(
          data.notifiedCount > 0
            ? `Publicado · ${data.notifiedCount} notificación(es) enviada(s)`
            : "Evento creado"
        );
      }
      setModalOpen(false);
      notifyEventsUpdated();
      load();
    } finally {
      setBusy(false);
    }
  }

  async function confirmFinish() {
    if (!finishing) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/events/${finishing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: finishing.phase === "SCHEDULED" ? "CANCELLED" : "ENDED",
          notifyUpdate: notifyOnFinish,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast.error(data.error ?? "Error al cerrar el evento");
        return;
      }
      toast.success(
        finishing.phase === "SCHEDULED" ? "Evento cancelado" : "Evento finalizado"
      );
      setFinishing(null);
      notifyEventsUpdated();
      load();
    } finally {
      setBusy(false);
    }
  }

  async function confirmBlockAction() {
    if (!blockAction) return;
    const { ev, block } = blockAction;
    setBusy(true);
    try {
      const r = await fetch(`/api/events/${ev.id}/blocks/${block.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ released: !block.released, notify: notifyBlockAction }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast.error(data.error ?? "No se pudo actualizar el bloque");
        return;
      }
      toast.success(block.released ? `Ingreso cerrado en ${block.name}` : `Ingreso habilitado en ${block.name}`);
      setBlockAction(null);
      notifyEventsUpdated();
      load();
    } finally {
      setBusy(false);
    }
  }

  async function startNow(ev: EventRow) {
    const r = await fetch(`/api/events/${ev.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startsAt: new Date().toISOString(), status: "ACTIVE" }),
    });
    const data = await r.json();
    if (!r.ok) return toast.error(data.error ?? "Error");
    toast.success(`"${ev.title}" ahora está en curso`);
    notifyEventsUpdated();
    load();
  }

  async function removeEvent(ev: EventRow) {
    if (!confirm(`¿Eliminar definitivamente "${ev.title}"?`)) return;
    const r = await fetch(`/api/events/${ev.id}`, { method: "DELETE" });
    const data = await r.json();
    if (!r.ok) return toast.error(data.error ?? "Error al eliminar");
    toast.success("Evento eliminado");
    notifyEventsUpdated();
    load();
  }

  const activeCount = events.filter((e) => e.phase === "ACTIVE").length;
  const scheduledCount = events.filter((e) => e.phase === "SCHEDULED").length;
  const closedBlocksCount = blocks.filter((b) => !b.entryAllowed).length;

  const visibleEvents = useMemo(() => {
    if (tab === "CURRENT") {
      return events.filter((e) => e.phase === "ACTIVE" || e.phase === "SCHEDULED");
    }
    return events.filter((e) => e.phase === "ENDED" || e.phase === "CANCELLED");
  }, [events, tab]);

  const nonDefaultBlocks = blocks.filter((b) => !b.isDefault);

  return (
    <div style={{ padding: 24 }}>
      <div className="row between" style={{ marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24 }}>
            Eventos y avisos
          </h1>
          <p className="muted" style={{ fontSize: 13 }}>
            Programa exposiciones, gestiona cierres por urgencia en bloques y envía comunicados a tu organización.
          </p>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn danger"
            onClick={() => openCreate("EMERGENCY")}
          >
            <I name="shieldAlert" size={16} />
            Declarar urgencia
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => openCreate("NOTICE")}
          >
            <I name="megaphone" size={16} />
            Enviar aviso
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => openCreate("EVENT")}
          >
            <I name="plus" size={16} />
            Nuevo evento
          </button>
        </div>
      </div>

      <div className="row" style={{ gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <Metric
            label="Eventos en curso"
            icon="calendar"
            value={activeCount}
            sub="visibles ahora mismo"
          />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <Metric
            label="Programados"
            icon="clock"
            value={scheduledCount}
            sub="se activarán en su fecha"
          />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <Metric
            label="Bloques con ingreso cerrado"
            icon="lock"
            value={closedBlocksCount}
            sub={`de ${blocks.length} bloques totales`}
          />
        </div>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <button
          type="button"
          className={"btn " + (tab === "CURRENT" ? "primary" : "ghost")}
          onClick={() => setTab("CURRENT")}
        >
          Vigentes y programados · {activeCount + scheduledCount}
        </button>
        <button
          type="button"
          className={"btn " + (tab === "HISTORY" ? "primary" : "ghost")}
          onClick={() => setTab("HISTORY")}
        >
          Historial · {events.length - (activeCount + scheduledCount)}
        </button>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {visibleEvents.map((ev) => {
          const kindOpt = KIND_OPTIONS.find((k) => k.id === ev.kind) ?? KIND_OPTIONS[0];
          const phaseBadge = PHASE_BADGE[ev.phase];
          return (
            <Card key={ev.id}>
              <div className="row between" style={{ alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <Badge kind={ev.phase === "ACTIVE" && ev.kind === "EMERGENCY" ? "no" : phaseBadge.kind}>
                      {phaseBadge.label}
                    </Badge>
                    <Badge kind={kindOpt.badge}>{kindOpt.label}</Badge>
                    {ev.showBanner && <Badge kind="info">En banner</Badge>}
                    <strong style={{ fontSize: 16 }}>{ev.title}</strong>
                  </div>
                  <p style={{ marginTop: 6, fontSize: 14, color: "var(--ink-700)" }}>
                    {ev.description}
                  </p>

                  <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    {ev.blocks.length > 0 ? (
                      <>
                        <span className="muted" style={{ fontSize: 12.5 }}>
                          {!ev.disableEntry
                            ? "Bloques asociados:"
                            : ev.blocks.some((b) => !b.released)
                            ? "Ingreso cerrado en:"
                            : "Ingreso habilitado en:"}
                        </span>
                        {ev.blocks.map((b) =>
                          ev.disableEntry && (ev.phase === "ACTIVE" || ev.phase === "SCHEDULED") ? (
                            <button
                              key={b.id}
                              type="button"
                              className="btn ghost"
                              style={{ minHeight: 28, padding: "2px 8px", fontSize: 12.5, gap: 6 }}
                              title={b.released ? "Volver a cerrar el ingreso" : "Habilitar el ingreso sin finalizar el evento"}
                              onClick={() => {
                                setBlockAction({ ev, block: b });
                                setNotifyBlockAction(true);
                              }}
                            >
                              <Badge kind={b.released ? "go" : ev.phase === "ACTIVE" ? "no" : "wait"}>{b.name}</Badge>
                              <I name={b.released ? "lock" : "unlock"} size={14} />
                              {b.released ? "Cerrar" : "Habilitar"}
                            </button>
                          ) : (
                            <Badge key={b.id} kind="info">
                              {b.name}
                            </Badge>
                          )
                        )}
                      </>
                    ) : (
                      <span className="muted" style={{ fontSize: 12.5 }}>
                        Comunicado general (sin cierre de bloques)
                      </span>
                    )}
                  </div>

                  <div
                    className="row muted mono"
                    style={{ gap: 14, flexWrap: "wrap", fontSize: 12, marginTop: 10 }}
                  >
                    <span>Inicio: {formatDate(ev.startsAt)}</span>
                    <span>
                      Término: {ev.endsAt ? formatDate(ev.endsAt) : "Hasta finalizar manualmente"}
                    </span>
                    <span>{ev.notifiedCount} notificados</span>
                  </div>
                </div>

                <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                  {ev.phase === "SCHEDULED" && (
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => startNow(ev)}
                    >
                      <I name="clock" size={15} />
                      Iniciar ahora
                    </button>
                  )}
                  {(ev.phase === "ACTIVE" || ev.phase === "SCHEDULED") && (
                    <button
                      type="button"
                      className="btn ok"
                      onClick={() => {
                        setFinishing(ev);
                        setNotifyOnFinish(ev.disableEntry && ev.blocks.length > 0);
                      }}
                    >
                      <I name="check" size={15} />
                      {ev.phase === "SCHEDULED" ? "Cancelar" : "Finalizar"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn ghost icon"
                    title="Editar"
                    onClick={() => openEdit(ev)}
                  >
                    <I name="pencil" size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn danger icon"
                    title="Eliminar"
                    onClick={() => removeEvent(ev)}
                  >
                    <I name="trash" size={16} />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}

        {visibleEvents.length === 0 && (
          <Card>
            <div className="col center" style={{ padding: "42px 16px", gap: 8, textAlign: "center" }}>
              <I name="calendar" size={36} style={{ color: "var(--accent-700)" }} />
              <p style={{ fontWeight: 600 }}>
                {tab === "CURRENT"
                  ? "No hay eventos activos ni programados"
                  : "Aún no hay eventos finalizados en el historial"}
              </p>
              <p className="muted" style={{ fontSize: 13, maxWidth: 440 }}>
                Puedes programar exposiciones temporales que cierren el ingreso a ciertos bloques o enviar avisos inmediatos a conductores y guardias.
              </p>
            </div>
          </Card>
        )}
      </div>

      {modalOpen && (
        <Modal
          title={editing ? "Editar evento o aviso" : "Nuevo evento o aviso"}
          width={620}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={saveEvent} className="col" style={{ gap: 14 }}>
            <div className="field">
              <span className="field-lbl">Tipo</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {KIND_OPTIONS.map((k) => {
                  const selected = kind === k.id;
                  return (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => {
                        setKind(k.id);
                        if (!editing) {
                          if (k.id === "NOTICE") setDisableEntry(false);
                          if (k.id === "EMERGENCY") {
                            setDisableEntry(true);
                            setScheduleMode("NOW");
                          }
                        }
                      }}
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        borderRadius: "var(--r-md)",
                        border: selected
                          ? "1.5px solid var(--accent)"
                          : "1px solid var(--line)",
                        background: selected ? "var(--accent-050)" : "var(--surface)",
                        cursor: "pointer",
                      }}
                    >
                      <div className="row" style={{ gap: 8 }}>
                        <I name={k.icon} size={16} />
                        <strong style={{ fontSize: 13.5 }}>{k.label}</strong>
                      </div>
                      <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>
                        {k.hint}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="field">
              <label className="field-lbl" htmlFor="ev-title">
                Título
              </label>
              <input
                id="ev-title"
                className="input"
                required
                minLength={3}
                maxLength={120}
                placeholder={
                  kind === "EMERGENCY"
                    ? "Ej: Urgencia — Cierre temporal Estacionamiento 1"
                    : kind === "EVENT"
                    ? "Ej: Feria de Exposición en Estacionamientos 3 y 4"
                    : "Ej: Aviso de operación en estacionamientos"
                }
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-lbl" htmlFor="ev-desc">
                Descripción / mensaje del aviso
              </label>
              <textarea
                id="ev-desc"
                className="textarea"
                rows={3}
                required
                minLength={3}
                maxLength={1000}
                placeholder="Explica el motivo, instrucciones para conductores o sectores alternativos..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="field">
              <div className="row between" style={{ alignItems: "center" }}>
                <span className="field-lbl">Bloques afectados (opcional para avisos)</span>
                <div className="row" style={{ gap: 6 }}>
                  {nonDefaultBlocks.length > 0 && (
                    <button
                      type="button"
                      className="btn ghost"
                      style={{ minHeight: 26, padding: "2px 8px", fontSize: 11.5 }}
                      onClick={() => setSelectedBlockIds(nonDefaultBlocks.map((b) => b.id))}
                    >
                      Todos los bloques
                    </button>
                  )}
                  {selectedBlockIds.length > 0 && (
                    <button
                      type="button"
                      className="btn ghost"
                      style={{ minHeight: 26, padding: "2px 8px", fontSize: 11.5 }}
                      onClick={() => setSelectedBlockIds([])}
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                {blocks.map((b) => {
                  const active = selectedBlockIds.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      className={"btn " + (active ? "primary" : "secondary")}
                      style={{ minHeight: 34, padding: "6px 12px", fontSize: 13 }}
                      onClick={() => toggleBlock(b.id)}
                    >
                      <I name={active ? "check" : "parking"} size={14} />
                      {b.name}
                      <span className="mono" style={{ fontSize: 11, opacity: 0.85 }}>
                        ({b.occupied}/{b.capacity})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedBlockIds.length > 0 && (
              <label
                className="row between"
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--line)",
                  background: "var(--surface-2)",
                  cursor: "pointer",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                    Desactivar ingreso a los bloques seleccionados
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Impide registrar nuevas entradas o traslados hacia esos bloques; quienes estén dentro podrán salir.
                  </div>
                </div>
                <span className="switch">
                  <input
                    type="checkbox"
                    checked={disableEntry}
                    onChange={(e) => setDisableEntry(e.target.checked)}
                  />
                  <span className="track" />
                  <span className="thumb" />
                </span>
              </label>
            )}

            <div className="field">
              <span className="field-lbl">Duración</span>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className={"btn " + (scheduleMode === "NOW" ? "primary" : "ghost")}
                  onClick={() => setScheduleMode("NOW")}
                >
                  <I name="clock" size={15} />
                  Desde ahora (hasta finalizar manualmente)
                </button>
                <button
                  type="button"
                  className={"btn " + (scheduleMode === "SCHEDULED" ? "primary" : "ghost")}
                  onClick={() => setScheduleMode("SCHEDULED")}
                >
                  <I name="calendar" size={15} />
                  Programar inicio y término
                </button>
              </div>
              {scheduleMode === "SCHEDULED" && (
                <div className="row" style={{ gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                  <div className="field" style={{ flex: 1, minWidth: 200 }}>
                    <label className="field-lbl" htmlFor="ev-starts">
                      Inicio
                    </label>
                    <input
                      id="ev-starts"
                      type="datetime-local"
                      className="input"
                      required
                      value={startsAtLocal}
                      onChange={(e) => setStartsAtLocal(e.target.value)}
                    />
                  </div>
                  <div className="field" style={{ flex: 1, minWidth: 200 }}>
                    <label className="field-lbl" htmlFor="ev-ends">
                      Término
                    </label>
                    <input
                      id="ev-ends"
                      type="datetime-local"
                      className="input"
                      required
                      value={endsAtLocal}
                      onChange={(e) => setEndsAtLocal(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <label
              className="row between"
              style={{
                padding: "10px 12px",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--line)",
                cursor: "pointer",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                  Mostrar como banner importante
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Aparece en la parte superior del portal de conductores y del panel de guardia mientras esté en curso.
                </div>
              </div>
              <span className="switch">
                <input
                  type="checkbox"
                  checked={showBanner}
                  onChange={(e) => setShowBanner(e.target.checked)}
                />
                <span className="track" />
                <span className="thumb" />
              </span>
            </label>

            <div
              style={{
                padding: "12px",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--line)",
                display: "grid",
                gap: 10,
              }}
            >
              <label className="row between" style={{ cursor: "pointer" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                    {editing
                      ? "Enviar notificación de actualización"
                      : "Enviar aviso a la bandeja de notificaciones"}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Notifica en la cuenta de las personas seleccionadas.
                  </div>
                </div>
                <span className="switch">
                  <input
                    type="checkbox"
                    checked={notify}
                    onChange={(e) => setNotify(e.target.checked)}
                  />
                  <span className="track" />
                  <span className="thumb" />
                </span>
              </label>

              <div className="field">
                <label className="field-lbl" htmlFor="ev-audience">
                  Audiencia del aviso y banner
                </label>
                <select
                  id="ev-audience"
                  className="select"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as EventAudience)}
                >
                  {AUDIENCE_OPTIONS.map((a) => (
                    <option
                      key={a.id}
                      value={a.id}
                      disabled={a.id === "AFFECTED_VEHICLES" && selectedBlockIds.length === 0}
                    >
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </button>
              <button type="submit" className="btn primary" disabled={busy}>
                <I name="check" size={16} />
                {editing ? "Guardar cambios" : "Publicar"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {blockAction && (
        <Modal
          title={blockAction.block.released ? "Volver a cerrar el bloque" : "Habilitar ingreso al bloque"}
          onClose={() => setBlockAction(null)}
        >
          <p style={{ fontSize: 14, color: "var(--ink-700)", marginBottom: 14 }}>
            {blockAction.block.released
              ? `${blockAction.block.name} volverá a tener el ingreso cerrado por "${blockAction.ev.title}".`
              : `${blockAction.block.name} volverá a permitir ingresos. "${blockAction.ev.title}" seguirá en curso.`}
          </p>

          <label
            className="row between"
            style={{
              padding: "10px 12px",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--line)",
              marginBottom: 16,
              cursor: "pointer",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>Notificar a la audiencia</div>
              <div className="muted" style={{ fontSize: 12 }}>
                Envía un aviso con el cambio de este bloque.
              </div>
            </div>
            <span className="switch">
              <input
                type="checkbox"
                checked={notifyBlockAction}
                onChange={(e) => setNotifyBlockAction(e.target.checked)}
              />
              <span className="track" />
              <span className="thumb" />
            </span>
          </label>

          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="btn ghost" onClick={() => setBlockAction(null)}>
              Volver
            </button>
            <button
              type="button"
              className={"btn " + (blockAction.block.released ? "danger" : "ok")}
              disabled={busy}
              onClick={confirmBlockAction}
            >
              <I name={blockAction.block.released ? "lock" : "unlock"} size={16} />
              Confirmar
            </button>
          </div>
        </Modal>
      )}

      {finishing && (
        <Modal
          title={
            finishing.phase === "SCHEDULED"
              ? "Cancelar evento programado"
              : "Finalizar evento en curso"
          }
          onClose={() => setFinishing(null)}
        >
          <p style={{ fontSize: 14, color: "var(--ink-700)", marginBottom: 14 }}>
            {finishing.phase === "SCHEDULED"
              ? `Se cancelará "${finishing.title}" y no se aplicará el cierre programado.`
              : `Al finalizar "${finishing.title}", los bloques asociados volverán a permitir ingresos de inmediato.`}
          </p>

          <label
            className="row between"
            style={{
              padding: "10px 12px",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--line)",
              marginBottom: 16,
              cursor: "pointer",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                Notificar a la audiencia
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                Envía un aviso informando que los estacionamientos vuelven a estar disponibles.
              </div>
            </div>
            <span className="switch">
              <input
                type="checkbox"
                checked={notifyOnFinish}
                onChange={(e) => setNotifyOnFinish(e.target.checked)}
              />
              <span className="track" />
              <span className="thumb" />
            </span>
          </label>

          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setFinishing(null)}
            >
              Volver
            </button>
            <button
              type="button"
              className="btn ok"
              disabled={busy}
              onClick={confirmFinish}
            >
              <I name="check" size={16} />
              Confirmar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
