import { randomBytes } from "crypto";
import argon2 from "argon2";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseJson, parseQuery } from "@/lib/request";
import { requirePermission } from "@/lib/rbac";
import { createApiKeySchema, listApiKeysSchema } from "@/lib/schemas";
import { writeAudit } from "@/lib/audit";

function generateApiKey() {
  const random = randomBytes(24).toString("base64url");
  const key = `sk_${random}`;
  const keyPrefix = key.slice(0, 8);
  return { key, keyPrefix };
}

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "api_keys", "read");
  if (permission) {
    return permission;
  }

  const parsed = parseQuery(new URL(request.url).searchParams, listApiKeysSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const targetUserId = parsed.data.userId ?? auth.user.id;
  if (auth.user.role === "STUDENT" && targetUserId !== auth.user.id) {
    return jsonError("FORBIDDEN", "Cannot access other users' keys", undefined, 403);
  }

  const apiKeys = await db.apiKey.findMany({
    where: { userId: targetUserId },
    orderBy: { createdAt: "desc" },
    take: parsed.data.limit,
    skip: parsed.data.offset,
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

  return jsonOk(apiKeys);
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "api_keys", "write");
  if (permission) {
    return permission;
  }

  const parsed = await parseJson(request, createApiKeySchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  if (auth.user.role === "STUDENT" && parsed.data.userId !== auth.user.id) {
    return jsonError("FORBIDDEN", "Cannot create keys for other users", undefined, 403);
  }

  const { key, keyPrefix } = generateApiKey();
  const keyHash = await argon2.hash(key, { type: argon2.argon2id });

  const apiKey = await db.apiKey.create({
    data: {
      userId: parsed.data.userId,
      label: parsed.data.label,
      keyHash,
      keyPrefix
    },
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
    action: "CREATE",
    entity: "api_key",
    entityId: apiKey.id
  });

  return jsonOk({ ...apiKey, key }, { status: 201 });
}
