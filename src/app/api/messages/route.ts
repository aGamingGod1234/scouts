import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { parseJson, parseQuery } from "@/lib/request";
import { requirePermission } from "@/lib/rbac";
import { createMessageSchema, listMessagesSchema } from "@/lib/schemas";
import { writeAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "messages", "read");
  if (permission) {
    return permission;
  }

  const parsed = parseQuery(new URL(request.url).searchParams, listMessagesSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const { conversationWith, status, limit, offset } = parsed.data;
  const where: Prisma.MessageWhereInput = {};

  if (conversationWith) {
    where.OR = [
      { senderId: auth.user.id, recipientId: conversationWith },
      { senderId: conversationWith, recipientId: auth.user.id }
    ];
  } else if (auth.user.role === "STUDENT") {
    where.OR = [{ senderId: auth.user.id }, { recipientId: auth.user.id }];
  }

  if (status) {
    where.status = status;
  }

  const messages = await db.message.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset
  });

  return jsonOk(messages);
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "messages", "write");
  if (permission) {
    return permission;
  }

  const parsed = await parseJson(request, createMessageSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  if (auth.user.role === "STUDENT" && parsed.data.recipientId === auth.user.id) {
    return jsonError("INVALID_INPUT", "Cannot message yourself", undefined, 422);
  }

  const message = await db.message.create({
    data: {
      senderId: auth.user.id,
      recipientId: parsed.data.recipientId,
      body: parsed.data.body,
      status: "SENT"
    }
  });

  await writeAudit({
    userId: auth.user.id,
    action: "CREATE",
    entity: "message",
    entityId: message.id
  });

  return jsonOk(message, { status: 201 });
}
