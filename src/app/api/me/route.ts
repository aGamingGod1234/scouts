import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const memberships = await db.userGroup.findMany({
    where: { userId: auth.user.id },
    select: { groupId: true }
  });

  return jsonOk({
    id: auth.user.id,
    email: auth.user.email,
    name: auth.user.name,
    role: auth.user.role,
    isActive: auth.user.isActive,
    groupIds: memberships.map((membership) => membership.groupId)
  });
}
