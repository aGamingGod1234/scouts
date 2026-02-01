import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseJson } from "@/lib/request";
import { requirePermission } from "@/lib/rbac";
import { idSchema, updateUserSchema } from "@/lib/schemas";
import { hashPassword } from "@/lib/password";
import { writeAudit } from "@/lib/audit";

function parseId(id: string) {
  const result = idSchema.safeParse(id);
  if (!result.success) {
    return jsonError("INVALID_INPUT", "Invalid user id", result.error.flatten(), 422);
  }
  return result.data;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const userId = parseId(params.id);
  if (userId instanceof Response) {
    return userId;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "users", "read");
  if (permission) {
    return permission;
  }

  if (auth.user.role === "STUDENT" && auth.user.id !== userId) {
    return jsonError("FORBIDDEN", "Cannot access other users", undefined, 403);
  }

  const user = await db.user.findUnique({
    where: { id: userId },
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

  if (!user) {
    return jsonError("NOT_FOUND", "User not found", undefined, 404);
  }

  return jsonOk(user);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const userId = parseId(params.id);
  if (userId instanceof Response) {
    return userId;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "users", "write");
  if (permission) {
    return permission;
  }

  const parsed = await parseJson(request, updateUserSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const data = { ...parsed.data } as {
    name?: string;
    role?: string;
    score?: number;
    isActive?: boolean;
    password?: string;
  };

  let passwordHash: string | undefined;
  if (data.password) {
    passwordHash = await hashPassword(data.password);
    delete data.password;
  }

  try {
    const user = await db.user.update({
      where: { id: userId },
      data: {
        ...data,
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
      action: "UPDATE",
      entity: "user",
      entityId: user.id
    });

    return jsonOk(user);
  } catch (error) {
    const message =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
        ? "User not found"
        : "Failed to update user";
    return jsonError("NOT_FOUND", message, undefined, 404);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const userId = parseId(params.id);
  if (userId instanceof Response) {
    return userId;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "users", "delete");
  if (permission) {
    return permission;
  }

  try {
    await db.user.delete({ where: { id: userId } });
    await writeAudit({
      userId: auth.user.id,
      action: "DELETE",
      entity: "user",
      entityId: userId
    });
    return jsonOk({ id: userId });
  } catch (error) {
    return jsonError("NOT_FOUND", "User not found", undefined, 404);
  }
}
