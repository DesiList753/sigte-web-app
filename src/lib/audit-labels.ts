export const ACTION_LABEL: Record<string, string> = {
  CREATE: "Creó",
  UPDATE: "Editó",
  DELETE: "Eliminó",
  ROLE_CHANGE: "Cambió el rol",
  RESOLVE: "Cerró",
  PLAN_CHANGE: "Cambió el plan",
  SUSPEND: "Suspendió",
  REACTIVATE: "Reactivó",
};

export const ENTITY_LABEL: Record<string, string> = {
  ORGANIZATION: "Organización",
  USER: "Usuario",
  VEHICLE: "Vehículo",
  PARKING_BLOCK: "Bloque",
  INFRACTION: "Infracción",
  PLAN: "Plan",
};

const DETAIL_LABEL: Record<string, string> = {
  email: "Correo",
  name: "Nombre",
  plate: "Patente",
  role: "Rol",
  status: "Estado",
  from: "Antes",
  to: "Ahora",
  plan: "Plan",
  slug: "Slug",
  active: "Activo",
  fields: "Campos",
};

const DETAIL_ORDER = Object.keys(DETAIL_LABEL);

const FIELD_LABEL: Record<string, string> = {
  name: "nombre legal",
  displayName: "nombre visible",
  slug: "slug",
  logoUrl: "logo",
  brandColor: "color",
  registrationForm: "formulario de registro",
  selfRegistration: "registro abierto",
  allowedEmailDomains: "dominios permitidos",
  maxUsers: "máximo de usuarios",
  maxGuards: "máximo de guardias",
  maxBlocks: "máximo de bloques",
  maxVehicles: "máximo de vehículos",
  features: "funciones",
};

const VALUE_LABEL: Record<string, string> = {
  USER: "Usuario",
  GUARD: "Guardia",
  ADMIN: "Administrador",
  RESOLVED: "Resuelta",
  DISMISSED: "Descartada",
};

function formatValue(key: string, value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => formatValue(key, v)).join(", ");
  if (typeof value === "boolean") return value ? "sí" : "no";
  const text = String(value);
  if (key === "fields") return FIELD_LABEL[text] ?? text;
  return VALUE_LABEL[text] ?? text;
}

export function formatDetail(detail: unknown) {
  if (!detail || typeof detail !== "object") return "";
  return Object.entries(detail as Record<string, unknown>)
    .sort(([a], [b]) => {
      const ia = DETAIL_ORDER.indexOf(a);
      const ib = DETAIL_ORDER.indexOf(b);
      return (ia === -1 ? DETAIL_ORDER.length : ia) - (ib === -1 ? DETAIL_ORDER.length : ib);
    })
    .map(([key, value]) => `${DETAIL_LABEL[key] ?? key}: ${formatValue(key, value)}`)
    .join(" · ");
}
