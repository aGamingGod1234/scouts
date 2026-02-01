import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseJson } from "@/lib/request";
import { requirePermission } from "@/lib/rbac";
import { idSchema, updateTaskSchema } from "@/lib/schemas";
import { writeAudit } from "@/lib/audit";

function parseId(id: string) {
  const result = idSchema.safeParse(id);
  if (!result.success) {
    return jsonError("INVALID_INPUT", "Invalid task id", result.error.flatten(), 422);
  }
  return result.data;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const taskId = parseId(params.id);
  if (taskId instanceof Response) {
    return taskId;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "tasks", "read");
  if (permission) {
    return permission;
  }

  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) {
    return jsonError("NOT_FOUND", "Task not found", undefined, 404);
  }

  if (auth.user.role === "STUDENT" && task.assigneeId !== auth.user.id) {
    return jsonError("FORBIDDEN", "Cannot access this task", undefined, 403);
  }

  return jsonOk(task);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const taskId = parseId(params.id);
  if (taskId instanceof Response) {
    return taskId;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "tasks", "write");
  if (permission) {
    return permission;
  }

  const parsed = await parseJson(request, updateTaskSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  if (
    auth.user.role === "STUDENT" &&
    parsed.data.assigneeId &&
    parsed.data.assigneeId !== auth.user.id
  ) {
    return jsonError("FORBIDDEN", "Cannot reassign tasks", undefined, 403);
  }

  try {
    const task = await db.task.update({
      where: { id: taskId },
      data: {
        ...parsed.data,
        assigneeId:
          parsed.data.assigneeId ??
          (auth.user.role === "STUDENT" ? auth.user.id : undefined)
      }
    });

    await writeAudit({
      userId: auth.user.id,
      action: "UPDATE",
      entity: "task",
      entityId: task.id
    });

    return jsonOk(task);
  } catch (error) {
    const message =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
        ? "Task not found"
        : "Failed to update task";
    return jsonError("NOT_FOUND", message, undefined, 404);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const taskId = parseId(params.id);
  if (taskId instanceof Response) {
    return taskId;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "tasks", "delete");
  if (permission) {
    return permission;
  }

  try {
    await db.task.delete({ where: { id: taskId } });
    await writeAudit({
      userId: auth.user.id,
      action: "DELETE",
      entity: "task",
      entityId: taskId
    });
    return jsonOk({ id: taskId });
  } catch (error) {
    return jsonError("NOT_FOUND", "Task not found", undefined, 404);
  }
}
