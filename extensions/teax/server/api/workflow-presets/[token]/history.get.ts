import { eq, desc } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";

/**
 * 获取预设的操作历史
 */
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, "token");

  if (!token) {
    throw createError({ statusCode: 400, message: "Missing token" });
  }

  const query = getQuery(event);
  const limit = Math.min(Number(query.limit) || 20, 100);

  const db = useDB();

  // 获取预设
  const [preset] = await db
    .select({ id: schema.workflowPresets.id })
    .from(schema.workflowPresets)
    .where(eq(schema.workflowPresets.share_token, token));

  if (!preset) {
    throw createError({ statusCode: 404, message: "Preset not found" });
  }

  // 获取历史记录
  const history = await db
    .select({
      id: schema.workflowPresetHistory.id,
      action: schema.workflowPresetHistory.action,
      actor_id: schema.workflowPresetHistory.actor_id,
      details: schema.workflowPresetHistory.details,
      created_at: schema.workflowPresetHistory.created_at,
      actor_name: schema.users.gitea_username,
      actor_avatar: schema.users.avatar_url,
    })
    .from(schema.workflowPresetHistory)
    .leftJoin(schema.users, eq(schema.workflowPresetHistory.actor_id, schema.users.id))
    .where(eq(schema.workflowPresetHistory.preset_id, preset.id))
    .orderBy(desc(schema.workflowPresetHistory.created_at))
    .limit(limit);

  return { history };
});
