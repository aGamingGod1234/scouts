import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseJson } from "@/lib/request";
import { requirePermission } from "@/lib/rbac";
import { idSchema, updateMessageSchema } from "@/lib/schemas";
import { writeAudit } from "@/lib/audit";

function parseId(id: string) {
  const result = idSchema.safeParse(id);
  if (!result.success) {
    return jsonError("INVALID_INPUT", "Invalid message id", result.error.flatten(), 422);
  }
  return result.data;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const messageId = parseId(params.id);
  if (messageId instanceof Response) {
    return messageId;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "messages", "read");
  if (permission) {
    return permission;
  }

  const message = await db.message.findUnique({ where: { id: messageId } });
  if (!message) {
    return jsonError("NOT_FOUND", "Message not found", undefined, 404);
  }

  const isParticipant =
    message.senderId === auth.user.id || message.recipientId === auth.user.id;
  if (auth.user.role === "STUDENT" && !isParticipant) {
    return jsonError("FORBIDDEN", "Cannot access this message", undefined, 403);
  }

  return jsonOk(message);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const messageId = parseId(params.id);
  if (messageId instanceof Response) {
    return messageId;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "messages", "write");
  if (permission) {
    return permission;
  }

  const parsed = await parseJson(request, updateMessageSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const message = await db.message.findUnique({ where: { id: messageId } });
  if (!message) {
    return jsonError("NOT_FOUND", "Message not found", undefined, 404);
  }

  const isParticipant =
    message.senderId === auth.user.id || message.recipientId === auth.user.id;
  if (auth.user.role === "STUDENT" && !isParticipant) {
    return jsonError("FORBIDDEN", "Cannot update this message", undefined, 403);
  }

  try {
    const updated = await db.message.update({
      where: { id: messageId },
      data: {
        ...parsed.data,
        readAt: parsed.data.readAt ?? undefined
      }
    });

    await writeAudit({
      userId: auth.user.id,
      action: "UPDATE",
      entity: "message",
      entityId: updated.id
    });

    return jsonOk(updated);
  } catch (error) {
    const messageText =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
        ? "Message not found"
        : "Failed to update message";
    return jsonError("NOT_FOUND", messageText, undefined, 404);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const messageId = parseId(params.id);
  if (messageId instanceof Response) {
    return messageId;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "messages", "delete");
  if (permission) {
    return permission;
  }

  const message = await db.message.findUnique({ where: { id: messageId } });
  if (!message) {
    return jsonError("NOT_FOUND", "Message not found", undefined, 404);
  }

  if (auth.user.role === "STUDENT" && message.senderId !== auth.user.id) {
    return jsonError("FORBIDDEN", "Cannot delete this message", undefined, 403);
  }

  await db.message.delete({ where: { id: messageId } });
  await writeAudit({
    userId: auth.user.id,
    action: "DELETE",
    entity: "message",
    entityId: messageId
  });
  return jsonOk({ id: messageId });
}
