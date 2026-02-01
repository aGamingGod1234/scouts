import { EventTargetType, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import {
  EventTargetInput,
  normalizeEventTargets,
  validateTargetPermissions,
  validateTargetShape
} from "@/lib/eventTargets";

export async function validateEventTargetsForRequest(
  actorRole: Role,
  targets: EventTargetInput[]
) {
  const normalizedTargets = normalizeEventTargets(targets);
  const shapeError = validateTargetShape(normalizedTargets);
  if (shapeError) {
    return {
      ok: false,
      response: jsonError("INVALID_INPUT", shapeError, undefined, 422)
    } as const;
  }

  const userTargets = normalizedTargets
    .filter((target) => target.type === EventTargetType.USER)
    .map((target) => target.userId!)
    .filter(Boolean);

  const groupTargets = normalizedTargets
    .filter((target) => target.type === EventTargetType.GROUP)
    .map((target) => target.groupId!)
    .filter(Boolean);

  const [users, groups] = await Promise.all([
    userTargets.length > 0
      ? db.user.findMany({
          where: { id: { in: userTargets } },
          select: { id: true, role: true }
        })
      : Promise.resolve([]),
    groupTargets.length > 0
      ? db.group.findMany({
          where: { id: { in: groupTargets } },
          select: { id: true }
        })
      : Promise.resolve([])
  ]);

  if (userTargets.length > 0 && users.length !== userTargets.length) {
    return {
      ok: false,
      response: jsonError(
        "INVALID_INPUT",
        "One or more target users do not exist",
        undefined,
        422
      )
    } as const;
  }

  if (groupTargets.length > 0 && groups.length !== groupTargets.length) {
    return {
      ok: false,
      response: jsonError(
        "INVALID_INPUT",
        "One or more target groups do not exist",
        undefined,
        422
      )
    } as const;
  }

  const userRolesById = new Map(users.map((user) => [user.id, user.role]));
  const permissionError = validateTargetPermissions(
    actorRole,
    normalizedTargets,
    userRolesById
  );
  if (permissionError) {
    return {
      ok: false,
      response: jsonError("FORBIDDEN", permissionError, undefined, 403)
    } as const;
  }

  return { ok: true, targets: normalizedTargets } as const;
}
