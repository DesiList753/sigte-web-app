import type { PlanFeature, Role } from "@prisma/client";
import { prisma } from "./prisma";

export type PlanInfo = {
  name: string;
  features: PlanFeature[];
  maxUsers: number | null;
  maxGuards: number | null;
  maxBlocks: number | null;
  maxVehicles: number | null;
};

export type LimitKind = "users" | "guards" | "blocks" | "vehicles";

export type PlanBlock = { message: string; extra: Record<string, unknown> };

export const LIMIT_KINDS: LimitKind[] = ["users", "guards", "blocks", "vehicles"];

const MAX_FIELD: Record<LimitKind, "maxUsers" | "maxGuards" | "maxBlocks" | "maxVehicles"> = {
  users: "maxUsers",
  guards: "maxGuards",
  blocks: "maxBlocks",
  vehicles: "maxVehicles",
};

const NOUN: Record<LimitKind, [string, string]> = {
  users: ["usuario", "usuarios"],
  guards: ["guardia", "guardias"],
  blocks: ["bloque", "bloques"],
  vehicles: ["vehículo", "vehículos"],
};

const FEATURE_TEXT: Record<PlanFeature, string> = {
  QR: "el acceso con QR",
  INFRACTIONS: "las infracciones",
  REPORTS: "los reportes",
};

export function limitKindFor(role: Role): LimitKind {
  return role === "GUARD" ? "guards" : "users";
}

export function countUsage(organizationId: string, kind: LimitKind) {
  if (kind === "users") {
    return prisma.membership.count({ where: { organizationId, active: true, role: { in: ["USER", "ADMIN"] } } });
  }
  if (kind === "guards") {
    return prisma.membership.count({ where: { organizationId, active: true, role: "GUARD" } });
  }
  if (kind === "blocks") {
    return prisma.parkingBlock.count({ where: { organizationId, defaultOf: { is: null } } });
  }
  return prisma.vehicle.count({ where: { organizationId } });
}

export async function limitUsage(organizationId: string, plan: PlanInfo) {
  const used = await Promise.all(LIMIT_KINDS.map((kind) => countUsage(organizationId, kind)));
  return Object.fromEntries(
    LIMIT_KINDS.map((kind, i) => [kind, { used: used[i], max: plan[MAX_FIELD[kind]] }])
  ) as Record<LimitKind, { used: number; max: number | null }>;
}

export async function limitBlock(
  organizationId: string,
  plan: PlanInfo,
  kind: LimitKind,
  options: { member?: boolean } = {}
): Promise<PlanBlock | null> {
  const max = plan[MAX_FIELD[kind]];
  if (max === null) return null;
  const used = await countUsage(organizationId, kind);
  if (used < max) return null;
  const [one, many] = NOUN[kind];
  const message = options.member
    ? "La organización alcanzó el máximo de usuarios de su plan. Avisa a su administración."
    : `Tu plan ${plan.name} permite hasta ${max} ${max === 1 ? one : many}. Contacta a VanillaSoft para ampliarlo.`;
  return { message, extra: { code: "PLAN_LIMIT", limit: kind, max, used } };
}

export function featureBlock(plan: PlanInfo, feature: PlanFeature): PlanBlock | null {
  if (plan.features.includes(feature)) return null;
  return {
    message: `Tu plan ${plan.name} no incluye ${FEATURE_TEXT[feature]}. Contacta a VanillaSoft para ampliarlo.`,
    extra: { code: "PLAN_FEATURE", feature },
  };
}
