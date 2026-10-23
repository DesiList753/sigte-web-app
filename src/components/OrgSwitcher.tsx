"use client";

import { useState } from "react";
import { toast } from "sonner";

export type OrgOption = { id: string; name: string };

export function OrgSwitcher({ options, current }: { options: OrgOption[]; current: string }) {
  const [busy, setBusy] = useState(false);
  if (options.length < 2) return null;

  async function change(organizationId: string) {
    setBusy(true);
    const res = await fetch("/api/auth/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBusy(false);
      toast.error(data.error ?? "No se pudo cambiar de organización");
      return;
    }
    window.location.assign(data.home);
  }

  return (
    <select
      className="select"
      aria-label="Cambiar de organización"
      title="Cambiar de organización"
      value={current}
      disabled={busy}
      onChange={(e) => change(e.target.value)}
      style={{ width: "auto", maxWidth: 200, minWidth: 0, height: 36, fontSize: 13, paddingTop: 0, paddingBottom: 0 }}
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
