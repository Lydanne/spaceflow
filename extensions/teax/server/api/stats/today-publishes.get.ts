import { sql, eq } from "drizzle-orm";
import { useDB, schema } from "../../db";
import { requireAuth } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const db = useDB();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  if (session.user.isAdmin) {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.publishTasks)
      .where(sql`${schema.publishTasks.createdAt} >= ${todayISO}`);
    return { count: result?.count ?? 0 };
  }

  // 普通用户：统计自己所属组织的项目的今日发布
  const [result] = await db
    .select({ count: sql<number>`count(distinct ${schema.publishTasks.id})::int` })
    .from(schema.publishTasks)
    .innerJoin(schema.projects, eq(schema.publishTasks.projectId, schema.projects.id))
    .innerJoin(schema.teams, eq(schema.teams.organizationId, schema.projects.organizationId))
    .innerJoin(schema.teamMembers, eq(schema.teamMembers.teamId, schema.teams.id))
    .where(
      sql`${schema.teamMembers.userId} = ${session.user.id} AND ${schema.publishTasks.createdAt} >= ${todayISO}`,
    );

  return { count: result?.count ?? 0 };
});
