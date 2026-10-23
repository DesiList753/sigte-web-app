"use client";

export type LimitKey = "users" | "guards" | "blocks" | "vehicles";
export type Limits = Record<LimitKey, { used: number; max: number | null }>;

const LABEL: Record<LimitKey, string> = {
  users: "Usuarios y administradores",
  guards: "Guardias",
  blocks: "Bloques",
  vehicles: "Vehículos",
};

export const LIMIT_KEYS = Object.keys(LABEL) as LimitKey[];

export function PlanUsage({ limits }: { limits: Limits }) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {LIMIT_KEYS.map((key) => {
        const { used, max } = limits[key];
        const full = max !== null && used >= max;
        return (
          <div key={key}>
            <div className="row between" style={{ fontSize: 13 }}>
              <span>{LABEL[key]}</span>
              <span className="mono" style={{ color: full ? "var(--no-700)" : "var(--ink-700)" }}>
                {max === null ? `${used} · sin límite` : `${used} / ${max}`}
              </span>
            </div>
            {max !== null && (
              <div style={{ height: 6, background: "var(--line-soft)", borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${Math.min(100, Math.round((used / max) * 100))}%`,
                    height: "100%",
                    background: full ? "var(--no)" : "var(--accent)",
                    borderRadius: 3,
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
