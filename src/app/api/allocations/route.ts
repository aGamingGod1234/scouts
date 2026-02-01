import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseJson, parseQuery } from "@/lib/request";
import { requirePermission } from "@/lib/rbac";
import { createAllocationSchema, listAllocationsSchema } from "@/lib/schemas";
import { writeAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "allocations", "read");
  if (permission) {
    return permission;
  }

  const parsed = parseQuery(new URL(request.url).searchParams, listAllocationsSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const { userId, resourceId, status, limit, offset } = parsed.data;
  const where: Prisma.AllocationWhereInput = {};

  if (auth.user.role === "STUDENT") {
    where.userId = auth.user.id;
  } else if (userId) {
    where.userId = userId;
  }

  if (resourceId) {
    where.resourceId = resourceId;
  }

  if (status) {
    where.status = status;
  }

  const allocations = await db.allocation.findMany({
    where,
    orderBy: { startsAt: "desc" },
    take: limit,
    skip: offset
  });

  return jsonOk(allocations);
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "allocations", "write");
  if (permission) {
    return permission;
  }

  const parsed = await parseJson(request, createAllocationSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const allocation = await db.allocation.create({
    data: {
      userId: parsed.data.userId,
      resourceId: parsed.data.resourceId,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt ?? null,
      status: parsed.data.status ?? "PENDING"
    }
  });

  await writeAudit({
    userId: auth.user.id,
    action: "CREATE",
    entity: "allocation",
    entityId: allocation.id
  });

  return jsonOk(allocation, { status: 201 });
}
