import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonOk } from "@/lib/http";
import { parseJson, parseQuery } from "@/lib/request";
import { requirePermission } from "@/lib/rbac";
import { createAnnouncementSchema, listAnnouncementsSchema } from "@/lib/schemas";
import { writeAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "announcements", "read");
  if (permission) {
    return permission;
  }

  const parsed = parseQuery(new URL(request.url).searchParams, listAnnouncementsSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const announcements = await db.announcement.findMany({
    orderBy: { publishedAt: "desc" },
    take: parsed.data.limit,
    skip: parsed.data.offset
  });

  return jsonOk(announcements);
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const permission = requirePermission(auth.user.role, "announcements", "write");
  if (permission) {
    return permission;
  }

  const parsed = await parseJson(request, createAnnouncementSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const announcement = await db.announcement.create({
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      publishedAt: parsed.data.publishedAt ?? null,
      createdById: auth.user.id
    }
  });

  await writeAudit({
    userId: auth.user.id,
    action: "CREATE",
    entity: "announcement",
    entityId: announcement.id
  });

  return jsonOk(announcement, { status: 201 });
}
