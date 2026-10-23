import { vi } from "vitest";

export function mockPrismaWithAudit(models: Record<string, unknown>) {
  const prisma: Record<string, unknown> = {
    ...models,
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
  prisma.$transaction = vi.fn((arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: unknown) => unknown)(prisma) : Promise.all(arg as unknown[])
  );
  return prisma;
}
