import { Role } from "@prisma/client";
import { jsonError } from "./http";

export type Resource =
  | "users"
  | "tasks"
  | "events"
  | "groups"
  | "announcements"
  | "notifications"
  | "messages"
  | "audit_log"
  | "teacher_settings"
  | "allocations"
  | "resources"
  | "api_keys"
  | "ai";

export type Action = "read" | "write" | "delete";

const rolePermissions: Record<Role, Record<Resource, Action[]>> = {
  DEV: {} as Record<Resource, Action[]>,
  ADMIN: {} as Record<Resource, Action[]>,
  TEACHER: {
    users: ["read"],
    tasks: ["read", "write", "delete"],
    events: ["read", "write", "delete"],
    groups: ["read", "write", "delete"],
    announcements: ["read", "write", "delete"],
    notifications: ["read", "write", "delete"],
    messages: ["read", "write", "delete"],
    audit_log: ["read"],
    teacher_settings: ["read", "write"],
    allocations: ["read", "write", "delete"],
    resources: ["read", "write", "delete"],
    api_keys: ["read", "write", "delete"],
    ai: ["read", "write"]
  },
  STUDENT: {
    users: ["read"],
    tasks: ["read"],
    events: ["read"],
    groups: ["read"],
    announcements: ["read"],
    notifications: ["read", "write"], // Students can mark their own notifications as read/unread
    messages: ["read", "write"],
    audit_log: [],
    teacher_settings: [],
    allocations: ["read"],
    resources: ["read"],
    api_keys: ["read", "write", "delete"],
    ai: []
  }
};

export function requirePermission(
  role: Role,
  resource: Resource,
  action: Action
) {
  if (role === "ADMIN" || role === "DEV") {
    return null;
  }
  const allowed = rolePermissions[role]?.[resource]?.includes(action);
  if (!allowed) {
    return jsonError("FORBIDDEN", "Insufficient permissions", undefined, 403);
  }
  return null;
}
