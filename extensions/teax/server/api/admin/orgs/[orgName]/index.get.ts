import { eq, sql } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAdmin } from "~~/server/utils/auth";
import { resolveOrgId } from "~~/server/utils/resolve-org";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { orgId } = await resolveOrgId(event);
  const db = useDB();

  const orgs = await db
    .select({
      id: schema.organizations.id,
      gitea_org_id: schema.organizations.gitea_org_id,
      name: schema.organizations.name,
      full_name: schema.organizations.full_name,
      avatar_url: schema.organizations.avatar_url,
      synced_at: schema.organizations.synced_at,
      created_at: schema.organizations.created_at,
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
