import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { idSchema } from "@/lib/schemas";
import { writeAudit } from "@/lib/audit";

function parseId(id: string) {
  const result = idSchema.safeParse(id);
  if (!result.success) {
    return jsonError("INVALID_INPUT", "Invalid api key id", result.error.flatten(), 422);
  }
  return result.data;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const apiKeyId = parseId(params.id);
  if (apiKeyId instanceof Response) {
    return apiKeyId;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "api_keys", "read");
  if (permission) {
    return permission;
  }

  const apiKey = await db.apiKey.findUnique({
    where: { id: apiKeyId },
    select: {
      id: true,
      userId: true,
      label: true,
      keyPrefix: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true
    }
  });

  if (!apiKey) {
    return jsonError("NOT_FOUND", "API key not found", undefined, 404);
  }

  if (auth.user.role === "STUDENT" && apiKey.userId !== auth.user.id) {
    return jsonError("FORBIDDEN", "Cannot access other users' keys", undefined, 403);
  }

  return jsonOk(apiKey);
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const apiKeyId = parseId(params.id);
  if (apiKeyId instanceof Response) {
    return apiKeyId;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "api_keys", "delete");
  if (permission) {
    return permission;
  }

  const existing = await db.apiKey.findUnique({ where: { id: apiKeyId } });
  if (!existing) {
    return jsonError("NOT_FOUND", "API key not found", undefined, 404);
  }

  if (auth.user.role === "STUDENT" && existing.userId !== auth.user.id) {
    return jsonError("FORBIDDEN", "Cannot revoke other users' keys", undefined, 403);
  }

  try {
    const apiKey = await db.apiKey.update({
      where: { id: apiKeyId },
      data: { revokedAt: new Date() },
      select: {
        id: true,
        userId: true,
        label: true,
        keyPrefix: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true
      }
    });

    await writeAudit({
      userId: auth.user.id,
      action: "REVOKE",
      entity: "api_key",
      entityId: apiKey.id
    });

    return jsonOk(apiKey);
  } catch (error) {
    const message =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
        ? "API key not found"
        : "Failed to revoke API key";
    return jsonError("NOT_FOUND", message, undefined, 404);
  }
}
