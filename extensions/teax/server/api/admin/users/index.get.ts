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

  const [userList, totalResult] = await Promise.all([
    db
      .select({
        id: schema.users.id,
        gitea_id: schema.users.gitea_id,
        gitea_username: schema.users.gitea_username,
        email: schema.users.email,
        avatar_url: schema.users.avatar_url,
        is_admin: schema.users.is_admin,
        created_at: schema.users.created_at,
        updated_at: schema.users.updated_at,
      })
      .from(schema.users)
      .orderBy(asc(schema.users.created_at))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(schema.users),
  ]);

  const total = Number(totalResult[0]?.count ?? 0);

  return {
    data: userList,
    total,
    page,
    limit,
    hasMore: offset + limit < total,
  };
});
