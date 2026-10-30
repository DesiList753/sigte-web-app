"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export const NOTIFICATIONS_UPDATED_EVENT = "sigte:notifications-updated";
export const EVENTS_UPDATED_EVENT = "sigte:events-updated";

export function notifyNotificationsUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
  }
}

export function notifyEventsUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENTS_UPDATED_EVENT));
    window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
  }
}

export function useUnreadNotifications(enabled = true) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(() => {
    if (!enabled) return;
    fetch("/api/notifications?summary=true")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.unreadCount === "number") setUnreadCount(d.unreadCount);
      })
      .catch(() => {});
  }, [enabled]);

  useEffect(() => {
    const t = setTimeout(refresh, 0);
    return () => clearTimeout(t);
  }, [pathname, refresh]);

  useEffect(() => {
    const onUpdate = () => refresh();
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdate);
    const id = setInterval(refresh, 30_000);
    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdate);
      clearInterval(id);
    };
  }, [refresh]);

  return unreadCount;
}

export function CountPill({ count, light }: { count: number; light?: boolean }) {
  if (count <= 0) return null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 19,
        height: 19,
        padding: "0 6px",
        borderRadius: 999,
        fontSize: 11,
        fontFamily: "var(--ff-mono)",
        fontWeight: 700,
        lineHeight: 1,
        background: light ? "#fff" : "var(--no)",
        color: light ? "var(--accent-900)" : "#fff",
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
