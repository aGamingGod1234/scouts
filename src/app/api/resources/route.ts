import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { parseJson, parseQuery } from "@/lib/request";
import { requirePermission } from "@/lib/rbac";
import { createResourceSchema, listResourcesSchema } from "@/lib/schemas";
import { writeAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "resources", "read");
  if (permission) {
    return permission;
  }

  const parsed = parseQuery(new URL(request.url).searchParams, listResourcesSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const { type, limit, offset } = parsed.data;
  const where: Prisma.ResourceWhereInput = type ? { type } : {};

  const resources = await db.resource.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset
  });

  return jsonOk(resources);
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "resources", "write");
  if (permission) {
    return permission;
  }

  const parsed = await parseJson(request, createResourceSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const resource = await db.resource.create({
    data: {
      name: parsed.data.name,
      type: parsed.data.type,
      url: parsed.data.url ?? null,
      metadata: parsed.data.metadata ?? {}
    }
  });

  await writeAudit({
    userId: auth.user.id,
    action: "CREATE",
    entity: "resource",
    entityId: resource.id
  });

  return jsonOk(resource, { status: 201 });
}
