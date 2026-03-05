import { eq, sql } from "drizzle-orm";
import { useDB, schema } from "../../../../db";
import { requireAdmin } from "../../../../utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const db = useDB();
  const orgId = getRouterParam(event, "orgId");

  if (!orgId) {
    throw createError({ statusCode: 400, message: "Missing orgId" });
  }

  const teamList = await db
    .select({
      id: schema.teams.id,
      organizationId: schema.teams.organizationId,
      giteaTeamId: schema.teams.giteaTeamId,
      name: schema.teams.name,
      description: schema.teams.description,
      syncedAt: schema.teams.syncedAt,
      createdAt: schema.teams.createdAt,
      memberCount:
        sql<number>`(SELECT COUNT(*) FROM team_members WHERE team_members.team_id = "teams"."id")`.as(
          "member_count",
        ),
    })
    .from(schema.teams)
    .where(eq(schema.teams.organizationId, orgId));

  return { data: teamList };
});
