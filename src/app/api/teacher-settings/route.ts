import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseJson, parseQuery } from "@/lib/request";
import { requirePermission } from "@/lib/rbac";
import { idSchema } from "@/lib/schemas";
import { writeAudit } from "@/lib/audit";

const teacherSettingsQuerySchema = z.object({
  userId: idSchema.optional()
});

const teacherSettingsBodySchema = z.object({
  userId: idSchema.optional(),
  settings: z.unknown()
});

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "teacher_settings", "read");
  if (permission) {
    return permission;
  }

  const parsed = parseQuery(new URL(request.url).searchParams, teacherSettingsQuerySchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const targetUserId = parsed.data.userId ?? auth.user.id;
  if (auth.user.role !== "ADMIN" && auth.user.role !== "DEV" && targetUserId !== auth.user.id) {
    return jsonError("FORBIDDEN", "Cannot access other users' settings", undefined, 403);
  }

  const settings = await db.teacherSettings.findUnique({
    where: { userId: targetUserId }
  });

  return jsonOk(settings);
}

export async function PUT(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "teacher_settings", "write");
  if (permission) {
    return permission;
  }

  const parsed = await parseJson(request, teacherSettingsBodySchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const targetUserId = parsed.data.userId ?? auth.user.id;
  if (auth.user.role !== "ADMIN" && auth.user.role !== "DEV" && targetUserId !== auth.user.id) {
    return jsonError("FORBIDDEN", "Cannot update other users' settings", undefined, 403);
  }

  const settings = await db.teacherSettings.upsert({
    where: { userId: targetUserId },
    update: {
      settings: parsed.data.settings
    },
    create: {
      userId: targetUserId,
      settings: parsed.data.settings
    }
  });

  await writeAudit({
    userId: auth.user.id,
    action: "UPSERT",
    entity: "teacher_settings",
    entityId: settings.id
  });

  return jsonOk(settings);
}
