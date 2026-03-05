import { eq, sql } from "drizzle-orm";
import { useDB, schema } from "../../../../db";
import { requireOrgOwnerOrAdmin } from "../../../../utils/org-owner";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  if (!orgId) {
    throw createError({ statusCode: 400, message: "Missing orgId" });
  }

  await requireOrgOwnerOrAdmin(event, orgId);
  const db = useDB();

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
