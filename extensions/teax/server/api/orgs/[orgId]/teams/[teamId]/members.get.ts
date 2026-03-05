import { eq } from "drizzle-orm";
import { useDB, schema } from "../../../../../db";
import { requireOrgOwnerOrAdmin } from "../../../../../utils/org-owner";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  const teamId = getRouterParam(event, "teamId");

  if (!orgId || !teamId) {
    throw createError({ statusCode: 400, message: "Missing orgId or teamId" });
  }

  await requireOrgOwnerOrAdmin(event, orgId);
  const db = useDB();

  const members = await db
    .select({
      id: schema.teamMembers.id,
      teamId: schema.teamMembers.teamId,
      userId: schema.teamMembers.userId,
      role: schema.teamMembers.role,
      joinedAt: schema.teamMembers.joinedAt,
      username: schema.users.giteaUsername,
      email: schema.users.email,
      avatarUrl: schema.users.avatarUrl,
      giteaId: schema.users.giteaId,
    })
    .from(schema.teamMembers)
    .innerJoin(schema.users, eq(schema.teamMembers.userId, schema.users.id))
    .where(eq(schema.teamMembers.teamId, teamId));

  return { data: members };
});
