import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseJson, parseQuery } from "@/lib/request";
import { requirePermission } from "@/lib/rbac";
import { createNotificationSchema, listNotificationsSchema } from "@/lib/schemas";
import { writeAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "notifications", "read");
  if (permission) {
    return permission;
  }

  const parsed = parseQuery(new URL(request.url).searchParams, listNotificationsSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const { userId, status, limit = 20, offset, cursor } = parsed.data;
  const where: Prisma.NotificationWhereInput = {};

  // Enforce ownership for students
  if (auth.user.role === "STUDENT") {
    where.userId = auth.user.id;
  } else if (userId) {
    where.userId = userId;
  }

  if (status) {
    where.status = status;
  }

  // Use cursor-based pagination when cursor is provided (for past notifications infinite scroll)
  if (cursor) {
    const cursorNotification = await db.notification.findUnique({
      where: { id: cursor },
      select: { createdAt: true }
    });

    if (cursorNotification) {
      where.createdAt = { lt: cursorNotification.createdAt };
    }
  }

  // Fetch one extra to determine if there are more results
  const notifications = await db.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: (limit ?? 20) + 1,
    skip: cursor ? 0 : offset
  });

  // Check if there are more results
  const hasMore = notifications.length > (limit ?? 20);
  const results = hasMore ? notifications.slice(0, -1) : notifications;
  const nextCursor = hasMore && results.length > 0 ? results[results.length - 1].id : null;

  return jsonOk({
    notifications: results,
    hasMore,
    nextCursor
  });
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "notifications", "write");
  if (permission) {
    return permission;
  }

  const parsed = await parseJson(request, createNotificationSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const notification = await db.notification.create({
    data: {
      userId: parsed.data.userId,
      title: parsed.data.title,
      body: parsed.data.body,
      type: parsed.data.type ?? "SYSTEM",
      deeplink: parsed.data.deeplink ?? null,
      status: parsed.data.status ?? "UNREAD",
      readAt: parsed.data.readAt ?? null
    }
  });

  await writeAudit({
    userId: auth.user.id,
    action: "CREATE",
    entity: "notification",
    entityId: notification.id
  });

  return jsonOk(notification, { status: 201 });
}
