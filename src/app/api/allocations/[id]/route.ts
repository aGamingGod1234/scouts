import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseJson } from "@/lib/request";
import { requirePermission } from "@/lib/rbac";
import { idSchema, updateAllocationSchema } from "@/lib/schemas";
import { writeAudit } from "@/lib/audit";

function parseId(id: string) {
  const result = idSchema.safeParse(id);
  if (!result.success) {
    return jsonError("INVALID_INPUT", "Invalid allocation id", result.error.flatten(), 422);
  }
  return result.data;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const allocationId = parseId(params.id);
  if (allocationId instanceof Response) {
    return allocationId;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "allocations", "read");
  if (permission) {
    return permission;
  }

  const allocation = await db.allocation.findUnique({ where: { id: allocationId } });
  if (!allocation) {
    return jsonError("NOT_FOUND", "Allocation not found", undefined, 404);
  }

  if (auth.user.role === "STUDENT" && allocation.userId !== auth.user.id) {
    return jsonError("FORBIDDEN", "Cannot access this allocation", undefined, 403);
  }

  return jsonOk(allocation);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const allocationId = parseId(params.id);
  if (allocationId instanceof Response) {
    return allocationId;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "allocations", "write");
  if (permission) {
    return permission;
  }

  const parsed = await parseJson(request, updateAllocationSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const allocation = await db.allocation.update({
      where: { id: allocationId },
      data: {
        ...parsed.data,
        endsAt: parsed.data.endsAt ?? undefined
      }
    });

    await writeAudit({
      userId: auth.user.id,
      action: "UPDATE",
      entity: "allocation",
      entityId: allocation.id
    });

    return jsonOk(allocation);
  } catch (error) {
    const message =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
        ? "Allocation not found"
        : "Failed to update allocation";
    return jsonError("NOT_FOUND", message, undefined, 404);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const allocationId = parseId(params.id);
  if (allocationId instanceof Response) {
    return allocationId;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "allocations", "delete");
  if (permission) {
    return permission;
  }

  try {
    await db.allocation.delete({ where: { id: allocationId } });
    await writeAudit({
      userId: auth.user.id,
      action: "DELETE",
      entity: "allocation",
      entityId: allocationId
    });
    return jsonOk({ id: allocationId });
  } catch (error) {
    return jsonError("NOT_FOUND", "Allocation not found", undefined, 404);
  }
}
