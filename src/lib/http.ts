import { NextResponse } from "next/server";
import type { ZodType, ZodTypeDef } from "zod";
import { logError } from "./logger";

export const json = (data: unknown, status = 200, headers?: Record<string, string>) =>
  NextResponse.json(data, { status, headers });
export const err = (message: string, status = 400, headers?: Record<string, string>) =>
  NextResponse.json({ error: message }, { status, headers });
export const tooMany = (retryAfter: number, what = "requests") =>
  err(`Too many ${what}. Please try again in ${retryAfter} seconds.`, 429, { "Retry-After": String(retryAfter) });

/** Wraps a route handler: unexpected exceptions are logged for admins and returned as a safe 500. */
export function route<C = unknown>(source: string, fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      await logError(source, e);
      return err("Something went wrong on our side. Please try again.", 500);
    }
  };
}

/** Parse + validate a JSON body. Returns either the typed data or a ready-to-return 400 response. */
export async function parseBody<T>(req: Request, schema: ZodType<T, ZodTypeDef, any>): Promise<{ data: T } | { response: Response }> {
  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { response: err(parsed.error.issues[0]?.message ?? "Invalid data") };
  return { data: parsed.data };
}
