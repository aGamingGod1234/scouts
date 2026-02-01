import { EventTargetType, Prisma, Role } from "@prisma/client";

export function buildEventTargetVisibilityFilter(
  userId: string,
  role: Role,
  groupIds: string[]
): Prisma.EventTargetListRelationFilter {
  const filters: Prisma.EventTargetWhereInput[] = [
    { type: EventTargetType.ALL },
    { type: EventTargetType.USER, userId },
    { type: EventTargetType.ROLE, role }
  ];

  if (groupIds.length > 0) {
    filters.push({
      type: EventTargetType.GROUP,
      groupId: { in: groupIds }
    });
  }

  return { some: { OR: filters } };
}
