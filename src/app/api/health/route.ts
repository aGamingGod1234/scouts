import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET() {
  try {
    await db.$queryRaw(Prisma.sql`SELECT 1`);
    return jsonOk({
      status: "ok",
      db: "ok",
      version: process.env.APP_VERSION ?? "dev"
    });
  } catch (error) {
    return jsonError(
      "INTERNAL_ERROR",
      "Database connectivity check failed",
      { detail: String(error) },
      500
    );
  }
}
