import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseJson } from "@/lib/request";
import { requirePermission } from "@/lib/rbac";
import { idSchema, updateResourceSchema } from "@/lib/schemas";
import { writeAudit } from "@/lib/audit";

function parseId(id: string) {
  const result = idSchema.safeParse(id);
  if (!result.success) {
    return jsonError("INVALID_INPUT", "Invalid resource id", result.error.flatten(), 422);
  }
  return result.data;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const resourceId = parseId(params.id);
  if (resourceId instanceof Response) {
    return resourceId;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "resources", "read");
  if (permission) {
    return permission;
  }

  const resource = await db.resource.findUnique({ where: { id: resourceId } });
  if (!resource) {
    return jsonError("NOT_FOUND", "Resource not found", undefined, 404);
  }

  return jsonOk(resource);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const resourceId = parseId(params.id);
  if (resourceId instanceof Response) {
    return resourceId;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "resources", "write");
  if (permission) {
    return permission;
  }

  const parsed = await parseJson(request, updateResourceSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const resource = await db.resource.update({
      where: { id: resourceId },
      data: {
        ...parsed.data,
        url: parsed.data.url ?? undefined,
        metadata: parsed.data.metadata ?? undefined
      }
    });

    await writeAudit({
      userId: auth.user.id,
      action: "UPDATE",
      entity: "resource",
      entityId: resource.id
    });

    return jsonOk(resource);
  } catch (error) {
    const message =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
        ? "Resource not found"
        : "Failed to update resource";
    return jsonError("NOT_FOUND", message, undefined, 404);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const resourceId = parseId(params.id);
  if (resourceId instanceof Response) {
    return resourceId;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "resources", "delete");
  if (permission) {
    return permission;
  }

  try {
    await db.resource.delete({ where: { id: resourceId } });
    await writeAudit({
      userId: auth.user.id,
      action: "DELETE",
      entity: "resource",
      entityId: resourceId
    });
    return jsonOk({ id: resourceId });
  } catch (error) {
    return jsonError("NOT_FOUND", "Resource not found", undefined, 404);
  }
}
