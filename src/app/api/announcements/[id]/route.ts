import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseJson } from "@/lib/request";
import { requirePermission } from "@/lib/rbac";
import { idSchema, updateAnnouncementSchema } from "@/lib/schemas";
import { writeAudit } from "@/lib/audit";

function parseId(id: string) {
  const result = idSchema.safeParse(id);
  if (!result.success) {
    return jsonError("INVALID_INPUT", "Invalid announcement id", result.error.flatten(), 422);
  }
  return result.data;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const announcementId = parseId(params.id);
  if (announcementId instanceof Response) {
    return announcementId;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "announcements", "read");
  if (permission) {
    return permission;
  }

  const announcement = await db.announcement.findUnique({
    where: { id: announcementId }
  });
  if (!announcement) {
    return jsonError("NOT_FOUND", "Announcement not found", undefined, 404);
  }

  return jsonOk(announcement);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const announcementId = parseId(params.id);
  if (announcementId instanceof Response) {
    return announcementId;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "announcements", "write");
  if (permission) {
    return permission;
  }

  const parsed = await parseJson(request, updateAnnouncementSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const announcement = await db.announcement.update({
      where: { id: announcementId },
      data: {
        ...parsed.data,
        publishedAt: parsed.data.publishedAt ?? undefined
      }
    });

    await writeAudit({
      userId: auth.user.id,
      action: "UPDATE",
      entity: "announcement",
      entityId: announcement.id
    });

    return jsonOk(announcement);
  } catch (error) {
    const message =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
        ? "Announcement not found"
        : "Failed to update announcement";
    return jsonError("NOT_FOUND", message, undefined, 404);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const announcementId = parseId(params.id);
  if (announcementId instanceof Response) {
    return announcementId;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "announcements", "delete");
  if (permission) {
    return permission;
  }

  try {
    await db.announcement.delete({ where: { id: announcementId } });
    await writeAudit({
      userId: auth.user.id,
      action: "DELETE",
      entity: "announcement",
      entityId: announcementId
    });
    return jsonOk({ id: announcementId });
  } catch (error) {
    return jsonError("NOT_FOUND", "Announcement not found", undefined, 404);
  }
}
