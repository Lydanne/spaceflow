import { desc, eq, sql } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAdmin } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const db = useDB();

  const query = getQuery(event);
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));
  const offset = (page - 1) * limit;

  const logs = await db
    .select({
      id: schema.auditLogs.id,
      action: schema.auditLogs.action,
      resource_type: schema.auditLogs.resource_type,
      resource_id: schema.auditLogs.resource_id,
      ip_address: schema.auditLogs.ip_address,
      detail: schema.auditLogs.detail,
      created_at: schema.auditLogs.created_at,
      username: schema.users.gitea_username,
      userAvatar: schema.users.avatar_url,
      orgName: schema.organizations.name,
    })
    .from(schema.auditLogs)
    .leftJoin(schema.users, eq(schema.auditLogs.user_id, schema.users.id))
    .leftJoin(schema.organizations, eq(schema.auditLogs.organization_id, schema.organizations.id))
    .orderBy(desc(schema.auditLogs.created_at))
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.auditLogs);

  return {
    data: logs,
    total: countResult?.total ?? 0,
    page,
    limit,
  };
});
