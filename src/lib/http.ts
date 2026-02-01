import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "RATE_LIMIT"
  | "UPSTREAM_ERROR";

export type ApiErrorShape = {
  code: ApiErrorCode;
  message: string;
  issues?: unknown;
};

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonError(
  code: ApiErrorCode,
  message: string,
  issues?: unknown,
  status = 400,
  init?: ResponseInit
) {
  return NextResponse.json(
    { ok: false, error: { code, message, issues } },
    { status, ...init }
  );
}
