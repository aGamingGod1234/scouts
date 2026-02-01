import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { parseJson, parseQuery } from "@/lib/request";
import { requirePermission } from "@/lib/rbac";
import { createGroupSchema, listGroupsSchema } from "@/lib/schemas";
import { writeAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "groups", "read");
  if (permission) {
    return permission;
  }

  const parsed = parseQuery(new URL(request.url).searchParams, listGroupsSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const { type, limit, offset } = parsed.data;
  const where: Prisma.GroupWhereInput = {};

  if (type) {
    where.type = type;
  }

  const groups = await db.group.findMany({
    where,
    orderBy: [{ type: "asc" }, { name: "asc" }],
    take: limit,
    skip: offset
  });

  return jsonOk(groups);
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "groups", "write");
  if (permission) {
    return permission;
  }

  const parsed = await parseJson(request, createGroupSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const group = await db.group.create({
    data: {
      name: parsed.data.name,
      type: parsed.data.type
    }
  });

  await writeAudit({
    userId: auth.user.id,
    action: "CREATE",
    entity: "group",
    entityId: group.id
  });

  return jsonOk(group, { status: 201 });
}
