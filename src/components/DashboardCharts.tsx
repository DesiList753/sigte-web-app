"use client";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, Plate } from "@/components/ui-system";

const AZUL = "#004B85", VERDE = "#008452", ROJO = "#D60019", AMARILLO = "#F7AE00", CELESTE = "#0a5a99", GRIS = "#8a97a5";
const PIE = [AZUL, VERDE, AMARILLO, GRIS];
const METODO: Record<string, string> = { PLATE: "Patente", QR: "QR", CARD: "Credencial", MANUAL: "Manual" };

export function DashboardCharts({ series, occupancy, methodDist, topVehicles }: {
  series: { date: string; in: number; out: number }[];
  occupancy: { name: string; capacity: number; occupied: number; percentage: number }[];
  methodDist: Record<string, number>;
  topVehicles: { plate: string; owner: string; count: number }[];
}) {
  const metodos = Object.entries(methodDist || {}).map(([k, v]) => ({ nombre: METODO[k] ?? k, n: v }));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, marginTop: 20 }}>
      <Card title="Entradas vs salidas · 7 días">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,140,152,.25)" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="in" name="Entradas" stroke={VERDE} strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="out" name="Salidas" stroke={CELESTE} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Métodos de acceso · 7 días">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={metodos} dataKey="n" nameKey="nombre" cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={2}>
              {metodos.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
            </Pie>
            <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Ocupación por sector · ahora">
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={occupancy} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,140,152,.25)" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} allowDecimals={false} /><Tooltip />
            <Bar dataKey="capacity" name="Capacidad" fill="rgba(128,140,152,.3)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="occupied" name="Ocupados" radius={[4, 4, 0, 0]}>
              {occupancy.map((sct, i) => <Cell key={i} fill={sct.percentage > 85 ? ROJO : sct.percentage > 50 ? AMARILLO : VERDE} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Vehículos más frecuentes · 7 días">
        {topVehicles.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>Sin registros suficientes.</p> : (
          <div className="col" style={{ gap: 8 }}>
            {topVehicles.map((v, i) => (
              <div key={v.plate} className="row between" style={{ padding: "7px 0", borderBottom: i < topVehicles.length - 1 ? "1px solid var(--line-soft)" : "none" }}>
                <span className="row" style={{ gap: 10 }}>
                  <span className="mono dim" style={{ fontSize: 12, width: 14 }}>{i + 1}</span>
                  <Plate size="sm">{v.plate}</Plate>
                  <span style={{ fontSize: 13 }}>{v.owner}</span>
                </span>
                <span className="mono" style={{ fontWeight: 700 }}>{v.count}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
