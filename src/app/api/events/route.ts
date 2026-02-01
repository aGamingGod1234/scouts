import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { parseJson, parseQuery } from "@/lib/request";
import { requirePermission } from "@/lib/rbac";
import { createEventSchema, listEventsSchema } from "@/lib/schemas";
import { writeAudit } from "@/lib/audit";
import { buildEventTargetVisibilityFilter } from "@/lib/eventVisibility";
import { validateEventTargetsForRequest } from "@/lib/eventTargetValidation";

async function getUserGroupIds(userId: string) {
  const memberships = await db.userGroup.findMany({
    where: { userId },
    select: { groupId: true }
  });
  return memberships.map((membership) => membership.groupId);
}

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "events", "read");
  if (permission) {
    return permission;
  }

  const parsed = parseQuery(new URL(request.url).searchParams, listEventsSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const {
    assigneeId,
    targetUserId,
    targetRole,
    targetGroupId,
    targetType,
    status,
    from,
    to,
    limit,
    offset
  } = parsed.data;
  const where: Prisma.EventWhereInput = {};

  if (auth.user.role === "STUDENT") {
    const groupIds = await getUserGroupIds(auth.user.id);
    where.targets = buildEventTargetVisibilityFilter(auth.user.id, auth.user.role, groupIds);
  } else {
    const resolvedTargetUserId = targetUserId ?? assigneeId;
    const targetFilters: Prisma.EventTargetWhereInput = {};
    if (targetType) {
      targetFilters.type = targetType;
    }
    if (resolvedTargetUserId) {
      targetFilters.userId = resolvedTargetUserId;
    }
    if (targetRole) {
      targetFilters.role = targetRole;
    }
    if (targetGroupId) {
      targetFilters.groupId = targetGroupId;
    }
    if (Object.keys(targetFilters).length > 0) {
      where.targets = { some: targetFilters };
    }
  }

  if (status) {
    where.status = status;
  }

  if (from || to) {
    where.startsAt = {
      gte: from ?? undefined,
      lte: to ?? undefined
    };
  }

  const events = await db.event.findMany({
    where,
    orderBy: { startsAt: "asc" },
    take: limit,
    skip: offset,
    include: { targets: true }
  });

  return jsonOk(events);
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "events", "write");
  if (permission) {
    return permission;
  }

  const parsed = await parseJson(request, createEventSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const validatedTargets = await validateEventTargetsForRequest(
    auth.user.role,
    parsed.data.targets
  );
  if (!validatedTargets.ok) {
    return validatedTargets.response;
  }

  const event = await db.event.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status ?? "DRAFT",
      category: parsed.data.category ?? "GENERAL",
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt ?? null,
      location: parsed.data.location,
      createdById: auth.user.id,
      targets: {
        create: validatedTargets.targets.map((target) => ({
          type: target.type,
          userId: target.userId,
          role: target.role,
          groupId: target.groupId
        }))
      }
    },
    include: { targets: true }
  });

  await writeAudit({
    userId: auth.user.id,
    action: "CREATE",
    entity: "event",
    entityId: event.id
  });

  return jsonOk(event, { status: 201 });
}
