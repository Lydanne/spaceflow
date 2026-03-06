import { asc, sql } from "drizzle-orm";
import { useDB, schema } from "../../../db";
import { requireAdmin } from "../../../utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const db = useDB();

  const query = getQuery(event);
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;

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
    .orderBy(asc(schema.organizations.name))
    .limit(limit)
    .offset(offset);

  const totalResult = await db.select({ count: sql<number>`COUNT(*)` }).from(schema.organizations);

  const total = Number(totalResult[0]?.count ?? 0);

  return {
    data: orgs,
    total,
    page,
    limit,
    hasMore: offset + limit < total,
  };
});
