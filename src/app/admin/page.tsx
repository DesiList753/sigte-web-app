"use client";

import { useEffect, useState } from "react";
import { Metric, Card, LotGrid } from "@/components/ui-system";
import { DashboardCharts } from "@/components/DashboardCharts";
import { useFeature } from "@/components/PlanContext";
import { PlanUsage, type Limits } from "@/components/PlanUsage";
import { lotLevel, type Lot } from "@/lib/design-data";
import { fetchWithSession } from "@/lib/session-fetch";

type Dashboard = {
  plan?: { name: string; limits: Limits };
  metrics: {
    totalUsers: number;
    totalGuards: number;
    totalAdmins: number;
    totalVehicles: number;
    authorizedVehicles: number;
    totalBlocks: number;
    totalAccessLogs: number;
    accessToday: number;
    currentInside: number;
    openInfractions: number;
    infractionsLast7: number;
    avgDailyAccess: number;
    authRate: number;
    peakHour: string | null;
  };
  series: { date: string; in: number; out: number }[];
  occupancy: { id: string; name: string; capacity: number; occupied: number; percentage: number }[];
  topVehicles: { plate: string; owner: string; count: number }[];
  methodDist: Record<string, number>;
};

export default function AdminDashboard() {
  const reports = useFeature("REPORTS");
  const infractions = useFeature("INFRACTIONS");
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    const load = () => fetchWithSession<Dashboard>("/api/dashboard").then((d) => d && setData(d));
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, []);

  if (!data) {
    return (
      <div style={{ padding: 24, display: "grid", gap: 16 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 120, borderRadius: 16 }} />
        ))}
      </div>
    );
  }

  const m = data.metrics;

  const lots: Lot[] = data.occupancy.map((b) => ({
    id: b.id,
    nombre: b.name,
    ocup: b.occupied,
    cap: b.capacity,
    ...lotLevel(b.occupied, b.capacity),
  }));

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
        <Metric
          label="Usuarios"
          icon="users"
          value={m.totalUsers.toLocaleString("es-CL")}
          sub={`+${m.totalGuards} guardias`}
        />
        <Metric
          label="Vehículos"
          icon="car"
          value={m.totalVehicles.toLocaleString("es-CL")}
          sub={`${m.authorizedVehicles} autorizados`}
        />
        <Metric
          label="Accesos hoy"
          icon="history"
          value={m.accessToday.toLocaleString("es-CL")}
          sub={`${m.totalAccessLogs} totales`}
        />
        <Metric
          label="Dentro ahora"
          icon="parking"
          value={m.currentInside.toLocaleString("es-CL")}
          sub={`${m.totalBlocks} bloques`}
        />
        {infractions ? (
          <Metric
            label="Infracciones abiertas"
            icon="shieldAlert"
            value={m.openInfractions.toLocaleString("es-CL")}
            sub="por resolver"
          />
        ) : (
          <Metric
            label="Promedio diario"
            icon="chart"
            value={m.avgDailyAccess.toLocaleString("es-CL")}
            sub="accesos por día"
          />
        )}
        <Metric
          label="Tasa autorización"
          icon="shieldCheck"
          value={m.authRate + "%"}
          sub="accesos válidos"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, alignItems: "start" }}>
        <Card title="Ocupación ahora" style={{ minWidth: 0 }}>
          <LotGrid cols={3} lots={lots} />
        </Card>
        {data.plan && (
          <Card title={`Plan ${data.plan.name}`} style={{ minWidth: 0 }}>
            <PlanUsage limits={data.plan.limits} />
            <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
              El bloque por defecto no cuenta para el límite. Para ampliar tu plan, contacta a VanillaSoft.
            </p>
          </Card>
        )}
      </div>

      {reports && (
        <DashboardCharts
          series={data.series}
          occupancy={data.occupancy}
          methodDist={data.methodDist}
          topVehicles={data.topVehicles}
        />
      )}
    </div>
  );
}
