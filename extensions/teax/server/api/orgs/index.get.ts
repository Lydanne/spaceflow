import { eq, sql } from "drizzle-orm";
import { useDB, schema } from "../../db";
import { requireAuth } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const db = useDB();

  const columns = {
    id: schema.organizations.id,
    giteaOrgId: schema.organizations.giteaOrgId,
    name: schema.organizations.name,
    displayName: schema.organizations.displayName,
    avatarUrl: schema.organizations.avatarUrl,
    syncedAt: schema.organizations.syncedAt,
    projectCount:
      sql<number>`(SELECT COUNT(*) FROM projects WHERE projects.organization_id = ${schema.organizations.id})`.as(
        "project_count",
      ),
  };

  // 管理员可以看到所有组织
  if (session.user.isAdmin) {
    const orgs = await db.select(columns).from(schema.organizations);
    return { data: orgs };
  }

  // 普通用户通过 team_members 关联获取所属组织
  const orgs = await db
    .select(columns)
    .from(schema.organizations)
    .innerJoin(schema.teams, eq(schema.teams.organizationId, schema.organizations.id))
    .innerJoin(schema.teamMembers, eq(schema.teamMembers.teamId, schema.teams.id))
    .where(eq(schema.teamMembers.userId, session.user.id))
    .groupBy(schema.organizations.id);

  return { data: orgs };
});
