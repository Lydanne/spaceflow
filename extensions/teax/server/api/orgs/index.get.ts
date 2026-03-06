import { eq, sql } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const db = useDB();

  const columns = {
    id: schema.organizations.id,
    gitea_org_id: schema.organizations.gitea_org_id,
    name: schema.organizations.name,
    full_name: schema.organizations.full_name,
    avatar_url: schema.organizations.avatar_url,
    synced_at: schema.organizations.synced_at,
    repoCount:
      sql<number>`(SELECT COUNT(*)::int FROM repositories WHERE repositories.organization_id = "organizations"."id")`.as(
        "repo_count",
      ),
  };

  // 管理员可以看到所有组织
  if (session.user.is_admin) {
    const orgs = await db.select(columns).from(schema.organizations);
    return { data: orgs };
  }

  // 普通用户通过 team_members 关联获取所属组织
  const orgs = await db
    .select(columns)
    .from(schema.organizations)
    .innerJoin(schema.teams, eq(schema.teams.organization_id, schema.organizations.id))
    .innerJoin(schema.teamMembers, eq(schema.teamMembers.team_id, schema.teams.id))
    .where(eq(schema.teamMembers.user_id, session.user.id))
    .groupBy(schema.organizations.id);

  return { data: orgs };
});
