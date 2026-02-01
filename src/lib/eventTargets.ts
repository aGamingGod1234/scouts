import { EventTargetType, Role } from "@prisma/client";

export type EventTargetInput = {
  type: EventTargetType;
  userId?: string;
  role?: Role;
  groupId?: string;
};

const roleTargetRules: Record<Role, {
  allowAll: boolean;
  allowedTypes: EventTargetType[];
  allowedRoles: Role[];
}> = {
  DEV: {
    allowAll: true,
    allowedTypes: [
      EventTargetType.USER,
      EventTargetType.ROLE,
      EventTargetType.GROUP,
      EventTargetType.ALL
    ],
    allowedRoles: [Role.DEV, Role.ADMIN, Role.TEACHER, Role.STUDENT]
  },
  ADMIN: {
    allowAll: true,
    allowedTypes: [
      EventTargetType.USER,
      EventTargetType.ROLE,
      EventTargetType.GROUP,
      EventTargetType.ALL
    ],
    allowedRoles: [Role.DEV, Role.ADMIN, Role.TEACHER, Role.STUDENT]
  },
  TEACHER: {
    allowAll: false,
    allowedTypes: [EventTargetType.USER, EventTargetType.ROLE, EventTargetType.GROUP],
    allowedRoles: [Role.TEACHER, Role.STUDENT]
  },
  STUDENT: {
    allowAll: false,
    allowedTypes: [EventTargetType.USER],
    allowedRoles: [Role.STUDENT]
  }
};

export function normalizeEventTargets(targets: EventTargetInput[]) {
  const seen = new Map<string, EventTargetInput>();
  for (const target of targets) {
    const normalized: EventTargetInput = {
      type: target.type,
      userId: target.userId ?? undefined,
      role: target.role ?? undefined,
      groupId: target.groupId ?? undefined
    };
    const key = `${normalized.type}:${normalized.userId ?? ""}:${normalized.role ?? ""}:${normalized.groupId ?? ""}`;
    if (!seen.has(key)) {
      seen.set(key, normalized);
    }
  }
  return Array.from(seen.values());
}

export function validateTargetShape(targets: EventTargetInput[]) {
  if (targets.length === 0) {
    return "At least one target is required.";
  }

  const hasAll = targets.some((target) => target.type === EventTargetType.ALL);
  if (hasAll && targets.length > 1) {
    return "The ALL target cannot be combined with other targets.";
  }

  for (const target of targets) {
    if (target.type === EventTargetType.USER) {
      if (!target.userId || target.role || target.groupId) {
        return "USER targets require userId only.";
      }
    }

    if (target.type === EventTargetType.ROLE) {
      if (!target.role || target.userId || target.groupId) {
        return "ROLE targets require role only.";
      }
    }

    if (target.type === EventTargetType.GROUP) {
      if (!target.groupId || target.userId || target.role) {
        return "GROUP targets require groupId only.";
      }
    }

    if (target.type === EventTargetType.ALL) {
      if (target.userId || target.role || target.groupId) {
        return "ALL targets cannot include userId, role, or groupId.";
      }
    }
  }

  return null;
}

export function getTargetRules(role: Role) {
  return roleTargetRules[role];
}

export function validateTargetPermissions(
  actorRole: Role,
  targets: EventTargetInput[],
  userRolesById: Map<string, Role>
) {
  const rules = roleTargetRules[actorRole];
  for (const target of targets) {
    if (!rules.allowedTypes.includes(target.type)) {
      return `Role ${actorRole} cannot target ${target.type}.`;
    }

    if (target.type === EventTargetType.ALL && !rules.allowAll) {
      return `Role ${actorRole} cannot target all users.`;
    }

    if (
      target.type === EventTargetType.ROLE &&
      target.role &&
      !rules.allowedRoles.includes(target.role)
    ) {
      return `Role ${actorRole} cannot target role ${target.role}.`;
    }

    if (target.type === EventTargetType.USER && target.userId) {
      const targetRole = userRolesById.get(target.userId);
      if (!targetRole) {
        return "One or more target users do not exist.";
      }
      if (!rules.allowedRoles.includes(targetRole)) {
        return `Role ${actorRole} cannot target user role ${targetRole}.`;
      }
    }
  }

  return null;
}
