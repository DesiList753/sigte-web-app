"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui-system";
import { I } from "@/components/Icon";
import { EVENTS_UPDATED_EVENT } from "@/components/NotificationsBadge";
import { formatDate } from "@/lib/utils";

type BannerEvent = {
  id: string;
  title: string;
  description: string;
  kind: "EVENT" | "EMERGENCY" | "MAINTENANCE" | "NOTICE";
  disableEntry: boolean;
  startsAt: string;
  endsAt: string | null;
  blocks: { id: string; name: string; released: boolean }[];
};

const KIND_META: Record<
  BannerEvent["kind"],
  {
    callout: string;
    badge: "no" | "wait" | "info";
    label: string;
    icon: string;
    iconColor: string;
  }
> = {
  EMERGENCY: {
    callout: "callout danger",
    badge: "no",
    label: "Urgencia",
    icon: "shieldAlert",
    iconColor: "var(--no-700)",
  },
  MAINTENANCE: {
    callout: "callout warn",
    badge: "wait",
    label: "Mantención",
    icon: "barrier",
    iconColor: "var(--wait-700)",
  },
  EVENT: {
    callout: "callout warn",
    badge: "wait",
    label: "Evento en curso",
    icon: "calendar",
    iconColor: "var(--wait-700)",
  },
  NOTICE: {
    callout: "callout",
    badge: "info",
    label: "Aviso importante",
    icon: "megaphone",
    iconColor: "var(--accent-700)",
  },
};

const STORAGE_KEY = "sigte:dismissed-banners";

function readDismissed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function ActiveEventsBanner({ compact }: { compact?: boolean }) {
  const [events, setEvents] = useState<BannerEvent[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(() => readDismissed());

  const load = useCallback(() => {
    fetch("/api/events?scope=active")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setEvents(d.events ?? []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    const onUpdate = () => load();
    window.addEventListener(EVENTS_UPDATED_EVENT, onUpdate);
    const id = setInterval(load, 30_000);
    return () => {
      clearTimeout(t);
      window.removeEventListener(EVENTS_UPDATED_EVENT, onUpdate);
      clearInterval(id);
    };
  }, [load]);

  function dismiss(id: string) {
    const next = Array.from(new Set([...dismissed, id]));
    setDismissed(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }

  const visible = events.filter(
    (ev) => ev.kind === "EMERGENCY" || !dismissed.includes(ev.id)
  );

  if (visible.length === 0) return null;

  return (
    <section
      aria-label="Avisos y eventos activos"
      style={{
        display: "grid",
        gap: 10,
        padding: compact ? "14px 24px 0" : "16px 24px 0",
        maxWidth: compact ? undefined : 920,
        margin: compact ? undefined : "0 auto",
      }}
    >
      {visible.map((ev) => {
        const meta = KIND_META[ev.kind] ?? KIND_META.NOTICE;
        const closed = ev.disableEntry && ev.blocks.some((b) => !b.released);
        return (
          <div
            key={ev.id}
            className={meta.callout}
            style={{ padding: "12px 16px" }}
          >
            <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
              <span
                style={{
                  marginTop: 2,
                  color: meta.iconColor,
                  flexShrink: 0,
                }}
              >
                <I name={meta.icon} size={20} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  className="row"
                  style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}
                >
                  <Badge kind={meta.badge}>{meta.label}</Badge>
                  <strong style={{ fontSize: 14.5 }}>{ev.title}</strong>
                  <span className="muted mono" style={{ fontSize: 11.5 }}>
                    {ev.endsAt
                      ? `Hasta ${formatDate(ev.endsAt)}`
                      : "Hasta nuevo aviso"}
                  </span>
                </div>
                <p style={{ fontSize: 13.5, marginTop: 5, color: "var(--ink-700)" }}>
                  {ev.description}
                </p>
                {ev.blocks.length > 0 && (
                  <div
                    className="row"
                    style={{ gap: 6, flexWrap: "wrap", marginTop: 8 }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: closed ? "var(--no-700)" : "var(--ink-700)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <I name={closed ? "lock" : ev.disableEntry ? "unlock" : "parking"} size={13} />
                      {closed ? "Ingreso cerrado:" : ev.disableEntry ? "Ingreso habilitado:" : "Bloques:"}
                    </span>
                    {ev.blocks.map((b) => (
                      <Badge key={b.id} kind={!ev.disableEntry ? "info" : b.released ? "go" : "no"}>
                        {b.name}
                        {ev.disableEntry && b.released ? " · habilitado" : ""}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {ev.kind !== "EMERGENCY" && (
                <button
                  type="button"
                  className="btn ghost icon"
                  onClick={() => dismiss(ev.id)}
                  title="Ocultar aviso en esta sesión"
                  aria-label="Ocultar aviso"
                  style={{ minWidth: 32, minHeight: 32, padding: 6 }}
                >
                  <I name="x" size={15} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
