import argon2 from "argon2";
import { ApiKey, User } from "@prisma/client";
import { db } from "./db";
import { jsonError } from "./http";

export type AuthContext = {
  user: User;
  apiKey: ApiKey;
};

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export async function requireAuth(
  request: Request
): Promise<AuthContext | ReturnType<typeof jsonError>> {
  const token = getBearerToken(request);
  if (!token) {
    return jsonError("UNAUTHORIZED", "Missing bearer token", undefined, 401);
  }

  const keyPrefix = token.slice(0, 8);
  const candidates = await db.apiKey.findMany({
    where: { keyPrefix, revokedAt: null },
    include: { user: true }
  });

  for (const candidate of candidates) {
    const match = await argon2.verify(candidate.keyHash, token).catch(() => false);
    if (match) {
      if (!candidate.user.isActive) {
        return jsonError("FORBIDDEN", "User is inactive", undefined, 403);
      }
      await db.apiKey.update({
        where: { id: candidate.id },
        data: { lastUsedAt: new Date() }
      });
      return { user: candidate.user, apiKey: candidate };
    }
  }

  return jsonError("UNAUTHORIZED", "Invalid API key", undefined, 401);
}
