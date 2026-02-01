import { ZodSchema } from "zod";
import { jsonError } from "./http";

export async function parseJson<T>(request: Request, schema: ZodSchema<T>) {
  const body = await request.json().catch(() => null);
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      ok: false,
      response: jsonError(
        "INVALID_INPUT",
        "Invalid request body",
        result.error.flatten(),
        422
      )
    } as const;
  }
  return { ok: true, data: result.data } as const;
}

export function parseQuery<T>(params: URLSearchParams, schema: ZodSchema<T>) {
  const raw = Object.fromEntries(params.entries());
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: jsonError(
        "INVALID_INPUT",
        "Invalid query parameters",
        result.error.flatten(),
        422
      )
    } as const;
  }
  return { ok: true, data: result.data } as const;
}
