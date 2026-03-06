import { eq, sql } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireOrgOwnerOrAdmin } from "~~/server/utils/org-owner";
import { resolveOrgId } from "~~/server/utils/resolve-org";

export default defineEventHandler(async (event) => {
  const { orgId } = await resolveOrgId(event);
  await requireOrgOwnerOrAdmin(event, orgId);
  const db = useDB();

  const teamList = await db
    .select({
      id: schema.teams.id,
      organization_id: schema.teams.organization_id,
      gitea_team_id: schema.teams.gitea_team_id,
      name: schema.teams.name,
      description: schema.teams.description,
      synced_at: schema.teams.synced_at,
      created_at: schema.teams.created_at,
      member_count:
        sql<number>`(SELECT COUNT(*) FROM team_members WHERE team_members.team_id = "teams"."id")`.as(
          "member_count",
        ),
    })
    .from(schema.teams)
    .where(eq(schema.teams.organization_id, orgId));

  return { data: teamList };
});
