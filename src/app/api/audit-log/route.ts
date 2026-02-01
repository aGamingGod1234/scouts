import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { parseQuery } from "@/lib/request";
import { requirePermission } from "@/lib/rbac";
import { listPaginationSchema } from "@/lib/schemas";

const auditLogQuerySchema = listPaginationSchema.extend({
  since: z.string().datetime().optional()
});

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "audit_log", "read");
  if (permission) {
    return permission;
  }

  const parsed = parseQuery(new URL(request.url).searchParams, auditLogQuerySchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const since = parsed.data.since ? new Date(parsed.data.since) : undefined;

  const auditLogs = await db.auditLog.findMany({
    where: since ? { createdAt: { gte: since } } : undefined,
    orderBy: { createdAt: "desc" },
    take: parsed.data.limit,
    skip: parsed.data.offset
  });

  return jsonOk(auditLogs);
}
