"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, Metric } from "@/components/ui-system";
import { I } from "@/components/Icon";

type Metrics = {
  vehicles: number;
  accessToday: number;
  openInfractions: number;
  unreadNotifs: number;
};

export default function UserHome() {
  const [m, setM] = useState<Metrics | null>(null);
  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then((d) => setM(d.metrics));
  }, []);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24 }}>Bienvenido</h1>
        <p className="muted" style={{ fontSize: 13 }}>Resumen de tu actividad</p>
      </div>

      {m && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <Metric label="Mis vehículos" icon="car" value={m.vehicles} />
          <Metric label="Accesos hoy" icon="arrowRight" value={m.accessToday} />
          <Metric label="Infracciones" icon="shieldAlert" value={m.openInfractions} />
          <Metric label="Notificaciones" icon="bell" value={m.unreadNotifs} />
        </div>
      )}

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <Link href="/user/qr" style={{ textDecoration: "none", color: "inherit" }}>
          <Card>
            <div className="row" style={{ gap: 12, alignItems: "center" }}>
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  display: "grid",
                  placeItems: "center",
                  background: "var(--accent-050)",
                  color: "var(--accent)",
                }}
              >
                <I name="qr" size={20} />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>Generar mi QR</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  Código válido por 5 minutos para presentar al guardia
                </div>
              </div>
              <I name="arrowRight" size={18} />
            </div>
          </Card>
        </Link>
        <Link href="/user/vehicles" style={{ textDecoration: "none", color: "inherit" }}>
          <Card>
            <div className="row" style={{ gap: 12, alignItems: "center" }}>
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  display: "grid",
                  placeItems: "center",
                  background: "var(--accent-050)",
                  color: "var(--accent)",
                }}
              >
                <I name="car" size={20} />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>Mis vehículos</div>
                <div className="muted" style={{ fontSize: 13 }}>Registra o edita tus patentes autorizadas</div>
              </div>
              <I name="arrowRight" size={18} />
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
