import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { parseJson } from "@/lib/request";
import { loginSchema } from "@/lib/schemas";
import { verifyPassword } from "@/lib/password";
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/auth";

const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$9rULqi3nc8nxljjdkPA8eQ$l5R+Pv8Wm6K4ar6xYEjV6QK4zWYFmv3StmkbW501dTU";

function getIpHash(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwardedFor?.split(",")[0]?.trim() || realIp?.trim();
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex");
}

export async function POST(request: Request) {
  const parsed = await parseJson(request, loginSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      passwordHash: true
    }
  });

  const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
  const passwordValid = await verifyPassword(password, passwordHash).catch(() => false);

  if (!user || !user.isActive || !passwordValid) {
    return jsonError("UNAUTHORIZED", "Invalid credentials", undefined, 401);
  }

  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const session = await db.session.create({
    data: {
      userId: user.id,
      expiresAt,
      userAgent: request.headers.get("user-agent"),
      ipHash: getIpHash(request)
    }
  });

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  const response = NextResponse.json(
    {
      ok: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      }
    },
    { status: 200 }
  );

  response.cookies.set(SESSION_COOKIE_NAME, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });

  return response;
}
