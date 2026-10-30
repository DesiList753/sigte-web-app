"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Badge } from "@/components/ui-system";
import { I } from "@/components/Icon";
import { notifyNotificationsUpdated } from "@/components/NotificationsBadge";
import { formatDate } from "@/lib/utils";

type NotificationKind = "SYSTEM" | "EVENT" | "EMERGENCY" | "MAINTENANCE" | "NOTICE";

type NotificationItem = {
  id: string;
  kind?: NotificationKind;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

const KIND_STYLE: Record<
  NotificationKind,
  {
    icon: string;
    badge: "no" | "wait" | "info" | "neutral";
    label: string;
    bg: string;
    fg: string;
    border: string;
  }
> = {
  EMERGENCY: {
    icon: "shieldAlert",
    badge: "no",
    label: "Urgencia",
    bg: "var(--no-050)",
    fg: "var(--no-700)",
    border: "var(--no)",
  },
  MAINTENANCE: {
    icon: "barrier",
    badge: "wait",
    label: "Mantención",
    bg: "var(--wait-050)",
    fg: "var(--wait-700)",
    border: "var(--wait)",
  },
  EVENT: {
    icon: "calendar",
    badge: "wait",
    label: "Evento",
    bg: "var(--wait-050)",
    fg: "var(--wait-700)",
    border: "var(--wait)",
  },
  NOTICE: {
    icon: "megaphone",
    badge: "info",
    label: "Aviso",
    bg: "var(--accent-050)",
    fg: "var(--accent-700)",
    border: "var(--accent)",
  },
  SYSTEM: {
    icon: "bell",
    badge: "neutral",
    label: "Actividad",
    bg: "var(--accent-050)",
    fg: "var(--accent-700)",
    border: "var(--accent)",
  },
};

export function NotificationsView({ padded }: { padded?: boolean }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<"ALL" | "UNREAD" | "ANNOUNCEMENTS">("ALL");

  useEffect(() => {
    let active = true;
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d) setItems(d.notifications ?? []);
      });
    return () => {
      active = false;
    };
  }, []);

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    notifyNotificationsUpdated();
  }

  async function markAllRead() {
    if (!items.some((n) => !n.read)) return;
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    notifyNotificationsUpdated();
  }

  const unreadCount = items.filter((n) => !n.read).length;

  const filtered = useMemo(() => {
    if (filter === "UNREAD") return items.filter((n) => !n.read);
    if (filter === "ANNOUNCEMENTS") {
      return items.filter((n) => n.kind && n.kind !== "SYSTEM");
    }
    return items;
  }, [items, filter]);

  return (
    <div style={{ display: "grid", gap: 16, padding: padded ? 24 : 0 }}>
      <header className="row between" style={{ alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24 }}>Notificaciones</h1>
          <p className="muted" style={{ fontSize: 13 }}>
            Avisos de estacionamientos, eventos y actividad de tu cuenta
          </p>
        </div>
        <button className="btn ghost" onClick={markAllRead} disabled={unreadCount === 0}>
          <I name="check" size={16} />
          Marcar todas como leídas
          {unreadCount > 0 && <Badge kind="info">{unreadCount}</Badge>}
        </button>
      </header>

      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className={"btn " + (filter === "ALL" ? "primary" : "ghost")}
          onClick={() => setFilter("ALL")}
        >
          Todas · {items.length}
        </button>
        <button
          type="button"
          className={"btn " + (filter === "UNREAD" ? "primary" : "ghost")}
          onClick={() => setFilter("UNREAD")}
        >
          No leídas · {unreadCount}
        </button>
        <button
          type="button"
          className={"btn " + (filter === "ANNOUNCEMENTS" ? "primary" : "ghost")}
          onClick={() => setFilter("ANNOUNCEMENTS")}
        >
          Eventos y avisos
        </button>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {filtered.map((n) => {
          const kind = n.kind ?? "SYSTEM";
          const st = KIND_STYLE[kind] ?? KIND_STYLE.SYSTEM;
          return (
            <Card
              key={n.id}
              style={
                n.read
                  ? { opacity: 0.78 }
                  : { borderColor: st.border }
              }
            >
              <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 9,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    background: n.read ? "var(--line-soft)" : st.bg,
                    color: n.read ? "var(--ink-500)" : st.fg,
                  }}
                >
                  <I name={st.icon} size={17} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row between" style={{ alignItems: "flex-start", gap: 12 }}>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {kind !== "SYSTEM" && <Badge kind={st.badge}>{st.label}</Badge>}
                      <strong>{n.title}</strong>
                    </div>
                    {!n.read && (
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ minHeight: 28, padding: "4px 10px", fontSize: 12 }}
                        onClick={() => markRead([n.id])}
                      >
                        Marcar leída
                      </button>
                    )}
                  </div>
                  <p style={{ marginTop: 5, fontSize: 14 }}>{n.message}</p>
                  <p className="muted mono" style={{ fontSize: 12, marginTop: 8 }}>
                    {formatDate(n.createdAt)}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <Card>
            <div className="col center" style={{ padding: "48px 0", gap: 6, textAlign: "center" }}>
              <I name="bell" size={40} style={{ color: "var(--accent-700)" }} />
              <p style={{ fontWeight: 600 }}>Sin notificaciones</p>
              <p className="muted" style={{ fontSize: 13 }}>
                {filter === "UNREAD"
                  ? "Estás al día con todos los avisos."
                  : "Te avisaremos cuando haya novedades en tu organización."}
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
