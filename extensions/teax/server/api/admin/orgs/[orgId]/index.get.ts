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

  const orgs = await db
    .select({
      id: schema.organizations.id,
      giteaOrgId: schema.organizations.giteaOrgId,
      name: schema.organizations.name,
      fullName: schema.organizations.fullName,
      avatarUrl: schema.organizations.avatarUrl,
      syncedAt: schema.organizations.syncedAt,
      createdAt: schema.organizations.createdAt,
      teamCount:
        sql<number>`(SELECT COUNT(*) FROM teams WHERE teams.organization_id = "organizations"."id")`.as(
          "team_count",
        ),
      memberCount:
        sql<number>`(SELECT COUNT(DISTINCT tm.user_id) FROM team_members tm JOIN teams t ON t.id = tm.team_id WHERE t.organization_id = "organizations"."id")`.as(
          "member_count",
        ),
    })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, orgId))
    .limit(1);

  if (!orgs.length) {
    throw createError({ statusCode: 404, message: "Organization not found" });
  }

  return orgs[0];
});
