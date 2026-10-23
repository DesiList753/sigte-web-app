"use client";

import { useEffect, useState } from "react";
import { Card, Plate } from "@/components/ui-system";
import { I } from "@/components/Icon";

type Vehicle = { id: string; plate: string };
type QRData = { token: string; dataUrl: string; vehicle: Vehicle; expiresAt: number };

const TTL_MS = 5 * 60_000;

export default function UserQR() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [qr, setQr] = useState<QRData | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/vehicles")
      .then((r) => r.json())
      .then((d) => {
        setVehicles(d.vehicles ?? []);
        if (d.vehicles?.[0]) setSelected(d.vehicles[0].id);
      });
  }, []);

  useEffect(() => {
    if (!qr) return;
    const t = setInterval(() => {
      const left = Math.max(0, Math.round((qr.expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) setQr(null);
    }, 500);
    return () => clearInterval(t);
  }, [qr]);

  async function generate() {
    if (!selected) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/qr?vehicleId=${selected}`).then((r) => r.json());
      setQr(r);
    } finally {
      setLoading(false);
    }
  }

  const pct = qr ? Math.round((secondsLeft / (TTL_MS / 1000)) * 100) : 0;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24 }}>Mi código QR de acceso</h1>
        <p className="muted" style={{ fontSize: 13 }}>
          Genera un QR único por vehículo. Válido 5 minutos.
        </p>
      </div>

      {vehicles.length === 0 ? (
        <Card>
          <div className="muted" style={{ fontSize: 13 }}>
            Primero registra un vehículo en la sección{" "}
            <span style={{ color: "var(--ink-900)", fontWeight: 600 }}>Mis vehículos</span>.
          </div>
        </Card>
      ) : (
        <Card title="Generar código">
          <div className="col" style={{ gap: 16 }}>
            <div className="field">
              <label className="field-lbl" htmlFor="vehiculo-qr">Vehículo</label>
              <select id="vehiculo-qr" className="select" value={selected} onChange={(e) => setSelected(e.target.value)}>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate}
                  </option>
                ))}
              </select>
            </div>

            <button className="btn primary lg block" onClick={generate} disabled={loading || !selected}>
              {loading ? (
                <I name="refresh" size={18} />
              ) : (
                <>
                  <I name="qr" size={18} />
                  Generar QR
                </>
              )}
            </button>

            {qr && (
              <div
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  background: "#fff",
                  padding: 24,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr.dataUrl} alt="QR" style={{ width: 256, height: 256 }} />
                <div style={{ marginTop: 16, width: "100%", display: "grid", gap: 8 }}>
                  <div className="row between">
                    <span className="row" style={{ gap: 6, alignItems: "center", fontSize: 13, fontWeight: 600 }}>
                      <I name="clock" size={14} />
                      {secondsLeft}s restantes
                    </span>
                    <Plate size="sm">{qr.vehicle.plate}</Plate>
                  </div>
                  <div style={{ height: 6, background: "var(--line)", borderRadius: 3, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: Math.min(100, pct) + "%",
                        background: "var(--accent)",
                        borderRadius: 3,
                        transition: "width .5s linear",
                      }}
                    />
                  </div>
                  <button
                    className="btn ghost block"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(qr.token);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      } catch {
                        /* clipboard no disponible */
                      }
                    }}
                  >
                    <I name={copied ? "check" : "file"} size={16} />
                    {copied ? "Token copiado" : "Copiar token"}
                  </button>
                  <span className="field-hint" style={{ textAlign: "center" }}>
                    El guardia puede escanear este QR con la cámara, o puedes
                    copiar el token y dictárselo si no hay cámara disponible.
                  </span>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
