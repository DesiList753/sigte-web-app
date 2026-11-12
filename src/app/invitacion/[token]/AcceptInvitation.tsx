"use client";

import { useState } from "react";
import { I } from "@/components/Icon";

export function AcceptInvitation({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(data.error ?? "No se pudo aceptar la invitación");
      return;
    }
    window.location.assign(data.home);
  }

  return (
    <div className="col" style={{ gap: 10 }}>
      {error && (
        <div className="field-err">
          <I name="alert" size={14} /> {error}
        </div>
      )}
      <button className="btn primary lg block" onClick={accept} disabled={busy}>
        <I name="check" size={18} /> {busy ? "Aceptando…" : "Aceptar invitación"}
      </button>
    </div>
  );
}

export function SwitchAccount({ next }: { next: string }) {
  async function change() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
  }
  return (
    <button className="btn secondary block" onClick={change}>
      <I name="logout" size={17} /> Cambiar de cuenta
    </button>
  );
}
