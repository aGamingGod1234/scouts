import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseJson } from "@/lib/request";
import { requirePermission } from "@/lib/rbac";
import { idSchema, updateNotificationSchema } from "@/lib/schemas";
import { writeAudit } from "@/lib/audit";

function parseId(id: string) {
  const result = idSchema.safeParse(id);
  if (!result.success) {
    return jsonError("INVALID_INPUT", "Invalid notification id", result.error.flatten(), 422);
  }
  return result.data;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const notificationId = parseId(params.id);
  if (notificationId instanceof Response) {
    return notificationId;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "notifications", "read");
  if (permission) {
    return permission;
  }

  const notification = await db.notification.findUnique({
    where: { id: notificationId }
  });
  if (!notification) {
    return jsonError("NOT_FOUND", "Notification not found", undefined, 404);
  }

  if (auth.user.role === "STUDENT" && notification.userId !== auth.user.id) {
    return jsonError("FORBIDDEN", "Cannot access this notification", undefined, 403);
  }

  return jsonOk(notification);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const notificationId = parseId(params.id);
  if (notificationId instanceof Response) {
    return notificationId;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "notifications", "write");
  if (permission) {
    return permission;
  }

  const parsed = await parseJson(request, updateNotificationSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const existing = await db.notification.findUnique({
    where: { id: notificationId }
  });
  if (!existing) {
    return jsonError("NOT_FOUND", "Notification not found", undefined, 404);
  }

  if (auth.user.role === "STUDENT" && existing.userId !== auth.user.id) {
    return jsonError("FORBIDDEN", "Cannot update this notification", undefined, 403);
  }

  try {
    const notification = await db.notification.update({
      where: { id: notificationId },
      data: {
        ...parsed.data,
        readAt: parsed.data.readAt ?? undefined
      }
    });

    await writeAudit({
      userId: auth.user.id,
      action: "UPDATE",
      entity: "notification",
      entityId: notification.id
    });

    return jsonOk(notification);
  } catch (error) {
    const message =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
        ? "Notification not found"
        : "Failed to update notification";
    return jsonError("NOT_FOUND", message, undefined, 404);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const notificationId = parseId(params.id);
  if (notificationId instanceof Response) {
    return notificationId;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "notifications", "delete");
  if (permission) {
    return permission;
  }

  try {
    await db.notification.delete({ where: { id: notificationId } });
    await writeAudit({
      userId: auth.user.id,
      action: "DELETE",
      entity: "notification",
      entityId: notificationId
    });
    return jsonOk({ id: notificationId });
  } catch (error) {
    return jsonError("NOT_FOUND", "Notification not found", undefined, 404);
  }
}
