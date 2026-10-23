import { NextRequest, NextResponse } from "next/server";
import type { ZodSchema } from "zod";
import type { PlanFeature } from "@prisma/client";
import {
  asTenant,
  getSessionFromRequest,
  resolveActor,
  type TenantRole,
  type TenantSession,
} from "./auth";
import { featureBlock, type PlanBlock } from "./plan";

export type TenantHandler<T = unknown> = (
  req: NextRequest,
  ctx: { session: TenantSession; params: T }
) => Promise<Response> | Response;

export type PlatformSession = { sub: string; email: string; name: string };

export type PlatformHandler<T = unknown> = (
  req: NextRequest,
  ctx: { session: PlatformSession; params: T }
) => Promise<Response> | Response;

export function withTenant<T = Record<string, never>>(
  handler: TenantHandler<T>,
  opts?: { roles?: TenantRole[]; feature?: PlanFeature }
) {
  return async (req: NextRequest, ctx: { params: Promise<T> }) => {
    const actor = await resolveActor(await getSessionFromRequest(req));
    if (!actor) return jsonError(401, "No autenticado");
    const session = asTenant(actor);
    if (!session) return jsonError(403, "Acceso denegado");
    if (actor.organization?.status !== "ACTIVE") {
      return jsonError(403, "La cuenta de tu organización está suspendida", { code: "ORG_SUSPENDED" });
    }
    if (opts?.roles && !opts.roles.includes(session.role)) {
      return jsonError(403, "Acceso denegado para el rol " + session.role);
    }
    const blocked = opts?.feature ? featureBlock(session.plan, opts.feature) : null;
    if (blocked) return planError(blocked);
    const resolvedParams = ctx?.params ? await ctx.params : ({} as T);
    return handler(req, { session, params: resolvedParams });
  };
}

export function planError(block: PlanBlock) {
  return jsonError(403, block.message, block.extra);
}

export function withPlatform<T = Record<string, never>>(handler: PlatformHandler<T>) {
  return async (req: NextRequest, ctx: { params: Promise<T> }) => {
    const actor = await resolveActor(await getSessionFromRequest(req));
    if (!actor) return jsonError(401, "No autenticado");
    if (actor.role !== "SUPER_ADMIN") return jsonError(403, "Acceso denegado");
    const resolvedParams = ctx?.params ? await ctx.params : ({} as T);
    return handler(req, {
      session: { sub: actor.id, email: actor.email, name: actor.name },
      params: resolvedParams,
    });
  };
}

export function jsonError(status: number, message: string, extra?: unknown) {
  return NextResponse.json({ error: message, ...(extra as object) }, { status });
}

type Parsed<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

export function validate<T>(raw: unknown, schema: ZodSchema<T>): Parsed<T> {
  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    response: NextResponse.json({ error: "Payload inválido", issues: result.error.issues }, { status: 400 }),
  };
}

export async function parseJson<T>(req: NextRequest, schema: ZodSchema<T>): Promise<Parsed<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, response: jsonError(400, "JSON mal formado") };
  }
  return validate(raw, schema);
}
