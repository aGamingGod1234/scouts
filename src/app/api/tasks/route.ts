import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseJson, parseQuery } from "@/lib/request";
import { requirePermission } from "@/lib/rbac";
import { createTaskSchema, listTasksSchema } from "@/lib/schemas";
import { writeAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "tasks", "read");
  if (permission) {
    return permission;
  }

  const parsed = parseQuery(new URL(request.url).searchParams, listTasksSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const { assigneeId, status, from, to, limit, offset } = parsed.data;
  const where: Prisma.TaskWhereInput = {};

  if (auth.user.role === "STUDENT") {
    where.assigneeId = auth.user.id;
  } else if (assigneeId) {
    where.assigneeId = assigneeId;
  }

  if (status) {
    where.status = status;
  }

  if (from || to) {
    where.dueDate = {
      gte: from ?? undefined,
      lte: to ?? undefined
    };
  }

  const tasks = await db.task.findMany({
    where,
    orderBy: { dueDate: "asc" },
    take: limit,
    skip: offset
  });

  return jsonOk(tasks);
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "tasks", "write");
  if (permission) {
    return permission;
  }

  const parsed = await parseJson(request, createTaskSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  if (
    auth.user.role === "STUDENT" &&
    parsed.data.assigneeId &&
    parsed.data.assigneeId !== auth.user.id
  ) {
    return jsonError("FORBIDDEN", "Cannot assign tasks to other users", undefined, 403);
  }

  const task = await db.task.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status ?? "TODO",
      assigneeId: parsed.data.assigneeId ?? (auth.user.role === "STUDENT" ? auth.user.id : null),
      dueDate: parsed.data.dueDate ?? null,
      createdById: auth.user.id
    }
  });

  await writeAudit({
    userId: auth.user.id,
    action: "CREATE",
    entity: "task",
    entityId: task.id
  });

  return jsonOk(task, { status: 201 });
}
