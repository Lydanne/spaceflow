import { desc, eq, sql } from "drizzle-orm";
import { useDB, schema } from "../../db";
import { requireAdmin } from "../../utils/auth";

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
      resourceType: schema.auditLogs.resourceType,
      resourceId: schema.auditLogs.resourceId,
      ipAddress: schema.auditLogs.ipAddress,
      detail: schema.auditLogs.detail,
      createdAt: schema.auditLogs.createdAt,
      username: schema.users.giteaUsername,
      userAvatar: schema.users.avatarUrl,
      orgName: schema.organizations.name,
    })
    .from(schema.auditLogs)
    .leftJoin(schema.users, eq(schema.auditLogs.userId, schema.users.id))
    .leftJoin(schema.organizations, eq(schema.auditLogs.organizationId, schema.organizations.id))
    .orderBy(desc(schema.auditLogs.createdAt))
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
