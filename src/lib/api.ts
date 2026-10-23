import { NextRequest, NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";
import {
  asTenant,
  getSessionFromRequest,
  resolveActor,
  type TenantRole,
  type TenantSession,
} from "./auth";

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
  opts?: { roles?: TenantRole[] }
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
    const resolvedParams = ctx?.params ? await ctx.params : ({} as T);
    return handler(req, { session, params: resolvedParams });
  };
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

export async function parseJson<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  try {
    const raw = await req.json();
    const data = schema.parse(raw);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Payload inválido", issues: err.issues },
          { status: 400 }
        ),
      };
    }
    return {
      ok: false,
      response: jsonError(400, "JSON mal formado"),
    };
  }
}
