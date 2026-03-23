import { eq, and, desc } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";

/**
 * 获取子预设的操作历史
 */
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, "token");
  const indexStr = getRouterParam(event, "index");

  if (!token || !indexStr) {
    throw createError({ statusCode: 400, message: "Missing parameters" });
  }

  const presetIndex = parseInt(indexStr, 10);
  if (isNaN(presetIndex)) {
    throw createError({ statusCode: 400, message: "Invalid preset index" });
  }

  const query = getQuery(event);
  const limit = Math.min(Number(query.limit) || 20, 100);

  const db = useDB();

  // 获取预设组
  const [group] = await db
    .select({ id: schema.workflowPresetGroups.id })
    .from(schema.workflowPresetGroups)
    .where(eq(schema.workflowPresetGroups.share_token, token));

  if (!group) {
    throw createError({ statusCode: 404, message: "Preset group not found" });
  }

  // 获取子预设
  const [preset] = await db
    .select({ id: schema.workflowPresets.id })
    .from(schema.workflowPresets)
    .where(
      and(
        eq(schema.workflowPresets.group_id, group.id),
        eq(schema.workflowPresets.preset_index, presetIndex),
      ),
    );

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
