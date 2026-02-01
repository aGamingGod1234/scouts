import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseJson } from "@/lib/request";
import { requirePermission } from "@/lib/rbac";
import { idSchema, updateEventSchema } from "@/lib/schemas";
import { writeAudit } from "@/lib/audit";
import { validateEventTargetsForRequest } from "@/lib/eventTargetValidation";

function parseId(id: string) {
  const result = idSchema.safeParse(id);
  if (!result.success) {
    return jsonError("INVALID_INPUT", "Invalid event id", result.error.flatten(), 422);
  }
  return result.data;
}

async function getUserGroupIds(userId: string) {
  const memberships = await db.userGroup.findMany({
    where: { userId },
    select: { groupId: true }
  });
  return memberships.map((membership) => membership.groupId);
}

function isEventVisibleToUser(
  event: { targets: { type: string; userId: string | null; role: string | null; groupId: string | null }[] },
  userId: string,
  role: string,
  groupIds: string[]
) {
  return event.targets.some((target) => {
    if (target.type === "ALL") return true;
    if (target.type === "USER" && target.userId === userId) return true;
    if (target.type === "ROLE" && target.role === role) return true;
    if (target.type === "GROUP" && target.groupId && groupIds.includes(target.groupId)) {
      return true;
    }
    return false;
  });
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const eventId = parseId(params.id);
  if (eventId instanceof Response) {
    return eventId;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "events", "read");
  if (permission) {
    return permission;
  }

  const event = await db.event.findUnique({
    where: { id: eventId },
    include: { targets: true }
  });
  if (!event) {
    return jsonError("NOT_FOUND", "Event not found", undefined, 404);
  }

  if (auth.user.role === "STUDENT") {
    const groupIds = await getUserGroupIds(auth.user.id);
    if (!isEventVisibleToUser(event, auth.user.id, auth.user.role, groupIds)) {
      return jsonError("FORBIDDEN", "Cannot access this event", undefined, 403);
    }
  }

  return jsonOk(event);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const eventId = parseId(params.id);
  if (eventId instanceof Response) {
    return eventId;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "events", "write");
  if (permission) {
    return permission;
  }

  const parsed = await parseJson(request, updateEventSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const targetsValidation = parsed.data.targets
    ? await validateEventTargetsForRequest(auth.user.role, parsed.data.targets)
    : null;

  if (targetsValidation && !targetsValidation.ok) {
    return targetsValidation.response;
  }

  try {
    const event = await db.event.update({
      where: { id: eventId },
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        status: parsed.data.status,
        category: parsed.data.category,
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt,
        location: parsed.data.location,
        ...(targetsValidation
          ? {
              targets: {
                deleteMany: {},
                create: targetsValidation.targets.map((target) => ({
                  type: target.type,
                  userId: target.userId,
                  role: target.role,
                  groupId: target.groupId
                }))
              }
            }
          : {})
      },
      include: { targets: true }
    });

    await writeAudit({
      userId: auth.user.id,
      action: "UPDATE",
      entity: "event",
      entityId: event.id
    });

    return jsonOk(event);
  } catch (error) {
    const message =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
        ? "Event not found"
        : "Failed to update event";
    return jsonError("NOT_FOUND", message, undefined, 404);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const eventId = parseId(params.id);
  if (eventId instanceof Response) {
    return eventId;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "events", "delete");
  if (permission) {
    return permission;
  }

  try {
    await db.event.delete({ where: { id: eventId } });
    await writeAudit({
      userId: auth.user.id,
      action: "DELETE",
      entity: "event",
      entityId: eventId
    });
    return jsonOk({ id: eventId });
  } catch (error) {
    return jsonError("NOT_FOUND", "Event not found", undefined, 404);
  }
}
