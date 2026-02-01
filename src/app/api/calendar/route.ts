import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { parseQuery } from "@/lib/request";
import { listCalendarSchema } from "@/lib/schemas";
import { buildEventTargetVisibilityFilter } from "@/lib/eventVisibility";

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

  const parsed = parseQuery(new URL(request.url).searchParams, listCalendarSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const { from, to, limit, offset } = parsed.data;
  const effectiveLimit = limit ?? 50;
  const effectiveOffset = offset ?? 0;
  const combinedLimit = effectiveLimit + effectiveOffset;

  const groupIds = await getUserGroupIds(auth.user.id);
  const targetFilter = buildEventTargetVisibilityFilter(
    auth.user.id,
    auth.user.role,
    groupIds
  );

  const eventWhere: Prisma.EventWhereInput = {
    status: { not: "CANCELED" },
    OR: [{ createdById: auth.user.id }, { targets: targetFilter }]
  };

  if (from || to) {
    eventWhere.startsAt = {
      gte: from ?? undefined,
      lte: to ?? undefined
    };
  }

  const taskWhere: Prisma.TaskWhereInput = {
    assigneeId: auth.user.id,
    dueDate: { not: null }
  };

  if (from || to) {
    taskWhere.dueDate = {
      gte: from ?? undefined,
      lte: to ?? undefined
    };
  }

  const [events, tasks, eventCount, taskCount] = await Promise.all([
    db.event.findMany({
      where: eventWhere,
      orderBy: { startsAt: "asc" },
      take: combinedLimit,
      include: { targets: true }
    }),
    db.task.findMany({
      where: taskWhere,
      orderBy: { dueDate: "asc" },
      take: combinedLimit
    }),
    db.event.count({ where: eventWhere }),
    db.task.count({ where: taskWhere })
  ]);

  const items = [
    ...events.map((event) => ({
      id: event.id,
      type: "event" as const,
      title: event.title,
      description: event.description,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      status: event.status,
      category: event.category,
      location: event.location,
      targets: event.targets
    })),
    ...tasks.map((task) => ({
      id: task.id,
      type: "task" as const,
      title: task.title,
      description: task.description,
      startsAt: task.dueDate!,
      status: task.status
    }))
  ].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const pagedItems = items.slice(effectiveOffset, effectiveOffset + effectiveLimit);
  const totalCount = eventCount + taskCount;
  const nextOffset = effectiveOffset + effectiveLimit < totalCount
    ? effectiveOffset + effectiveLimit
    : null;

  return jsonOk({
    items: pagedItems,
    totalCount,
    nextOffset
  });
}
