import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseJson } from "@/lib/request";
import { requirePermission } from "@/lib/rbac";
import { idSchema, markNotificationStatusSchema } from "@/lib/schemas";
import { writeAudit } from "@/lib/audit";

function parseId(id: string) {
    const result = idSchema.safeParse(id);
    if (!result.success) {
        return jsonError("INVALID_INPUT", "Invalid notification id", result.error.flatten(), 422);
    }
    return result.data;
}

/**
 * PATCH /api/notifications/[id]/status
 * Idempotent endpoint to mark a notification as READ or UNREAD.
 * - Users can only modify their own notifications
 * - Sets readAt to now() when READ, null when UNREAD
 */
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

    const parsed = await parseJson(request, markNotificationStatusSchema);
    if (!parsed.ok) {
        return parsed.response;
    }

    // Find the notification first to check ownership
    const existing = await db.notification.findUnique({
        where: { id: notificationId }
    });

    if (!existing) {
        return jsonError("NOT_FOUND", "Notification not found", undefined, 404);
    }

    // Enforce ownership: users can only modify their own notifications
    if (existing.userId !== auth.user.id) {
        return jsonError("FORBIDDEN", "Cannot modify this notification", undefined, 403);
    }

    // Idempotent: if already in target status, just return the notification
    if (existing.status === parsed.data.status) {
        return jsonOk(existing);
    }

    const isMarkingRead = parsed.data.status === "READ";

    const notification = await db.notification.update({
        where: { id: notificationId },
        data: {
            status: parsed.data.status,
            readAt: isMarkingRead ? new Date() : null
        }
    });

    await writeAudit({
        userId: auth.user.id,
        action: isMarkingRead ? "MARK_READ" : "MARK_UNREAD",
        entity: "notification",
        entityId: notification.id
    });

    return jsonOk(notification);
}
