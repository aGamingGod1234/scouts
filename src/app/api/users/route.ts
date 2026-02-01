import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseJson, parseQuery } from "@/lib/request";
import { requirePermission } from "@/lib/rbac";
import { createUserSchema, listUsersSchema } from "@/lib/schemas";
import { hashPassword } from "@/lib/password";
import { writeAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "users", "read");
  if (permission) {
    return permission;
  }

  const parsed = parseQuery(new URL(request.url).searchParams, listUsersSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const { orderBy, direction, limit, offset } = parsed.data;
  const isStudent = auth.user.role === "STUDENT";

  const where: Prisma.UserWhereInput = isStudent
    ? { id: auth.user.id }
    : undefined;

  const users = await db.user.findMany({
    where,
    orderBy: {
      [orderBy ?? "createdAt"]: direction ?? "desc"
    },
    take: limit,
    skip: offset,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      score: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return jsonOk(users);
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "users", "write");
  if (permission) {
    return permission;
  }

  const parsed = await parseJson(request, createUserSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const passwordHash = await hashPassword(parsed.data.password);

  try {
    const user = await db.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        role: parsed.data.role ?? "STUDENT",
        score: parsed.data.score ?? 0,
        passwordHash
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        score: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    await writeAudit({
      userId: auth.user.id,
      action: "CREATE",
      entity: "user",
      entityId: user.id
    });

    return jsonOk(user, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
        ? "Email already exists"
        : "Failed to create user";
    return jsonError("CONFLICT", message, undefined, 409);
  }
}
