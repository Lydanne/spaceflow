import { eq, and } from "drizzle-orm";
import { useDB, schema } from "../../../db";
import { requireAuth } from "../../../utils/auth";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  if (!orgId) {
    throw createError({ statusCode: 400, message: "Missing orgId" });
  }

  const session = await requireAuth(event);

  if (session.user.isAdmin) {
    return { role: "admin" };
  }

  const db = useDB();
  const ownership = await db
    .select({ role: schema.teamMembers.role })
    .from(schema.teamMembers)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.teamMembers.teamId))
    .where(
      and(
        eq(schema.teams.organizationId, orgId),
        eq(schema.teamMembers.userId, session.user.id),
        eq(schema.teamMembers.role, "owner"),
      ),
    )
    .limit(1);

  if (ownership.length > 0) {
    return { role: "owner" };
  }

  return { role: "member" };
});
