export type Estado = "go" | "no" | "wait" | "neutral";

export const ESTADO_LABEL: Record<Estado | "info", string> = {
  go: "Autorizado",
  no: "Denegado",
  wait: "Pendiente",
  neutral: "—",
  info: "Info",
};

export interface Acceso {
  t: string;
  patente: string;
  titular: string;
  rol: string;
  estado: Estado;
  acceso: string;
  via: string;
  direccion?: "in" | "out";
}

export interface Lot {
  id: string;
  nombre: string;
  ocup: number;
  cap: number;
  pct: number;
  estado: string;
  level: "low" | "mid" | "high" | "full";
}

/** Deriva nivel/estado de un lote a partir de ocupación. */
export function lotLevel(ocup: number, cap: number): Pick<Lot, "pct" | "estado" | "level"> {
  const pct = cap ? Math.round((ocup / cap) * 100) : 0;
  if (ocup >= cap) return { pct: 100, estado: "Lleno", level: "full" };
  if (pct > 85) return { pct, estado: "Crítico", level: "high" };
  if (pct > 50) return { pct, estado: "Casi lleno", level: "mid" };
  return { pct, estado: "Disponible", level: "low" };
}

export const INFRACTION_TYPE_LABEL: Record<string, string> = {
  WRONG_BLOCK: "Estacionado en bloque equivocado",
  UNAUTHORIZED_ENTRY: "Ingreso no autorizado",
  DOUBLE_PARKING: "Doble fila",
  EXPIRED_PERMIT: "Permiso expirado",
  BLOCKING_ACCESS: "Bloqueando accesos",
  SPEEDING: "Exceso de velocidad",
  OTHER: "Otra",
};
