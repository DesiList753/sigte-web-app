import type { AuditAction, AuditEntity, Prisma } from "@prisma/client";

type AuditInput = {
  organizationId: string | null;
  actor: { sub: string; name: string };
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string | null;
  detail?: Prisma.InputJsonObject;
};

export function auditData(input: AuditInput): Prisma.AuditLogUncheckedCreateInput {
  return {
    organizationId: input.organizationId,
    actorId: input.actor.sub,
    actorName: input.actor.name,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    detail: input.detail,
  };
}
