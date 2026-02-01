import argon2 from "argon2";
import { ApiKey, Session, User } from "@prisma/client";
import { db } from "./db";
import { jsonError } from "./http";

export type AuthContext = {
  user: User;
  apiKey?: ApiKey | null;
  session?: Session | null;
};

export const SESSION_COOKIE_NAME = "scout_session";
export const SESSION_TTL_DAYS = 7;
export const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60;

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function getCookieValue(request: Request, name: string) {
  const header = request.headers.get("cookie");
  if (!header) return null;
  const cookies = header.split(";").map((cookie) => cookie.trim());
  for (const cookie of cookies) {
    if (!cookie) continue;
    const [key, ...rest] = cookie.split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

export async function requireAuth(
  request: Request
): Promise<AuthContext | ReturnType<typeof jsonError>> {
  const token = getBearerToken(request);
  if (!token) {
    const sessionId = getCookieValue(request, SESSION_COOKIE_NAME);
    if (!sessionId) {
      return jsonError("UNAUTHORIZED", "Missing credentials", undefined, 401);
    }

    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: { user: true }
    });

    const now = new Date();
    if (!session || session.revokedAt || session.expiresAt <= now) {
      if (session && !session.revokedAt && session.expiresAt <= now) {
        await db.session
          .update({ where: { id: session.id }, data: { revokedAt: now } })
          .catch(() => undefined);
      }
      return jsonError("UNAUTHORIZED", "Invalid session", undefined, 401);
    }

    if (!session.user.isActive) {
      return jsonError("FORBIDDEN", "User is inactive", undefined, 403);
    }

    return { user: session.user, session };
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
