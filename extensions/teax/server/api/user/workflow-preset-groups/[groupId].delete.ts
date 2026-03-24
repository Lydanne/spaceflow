import { and, eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const db = useDB();

  const groupId = getRouterParam(event, "groupId");
  if (!groupId) {
    throw createError({ statusCode: 400, message: "Missing group ID" });
  }

  // 只能删除自己创建的预设组（级联删除子预设）
  const deleted = await db
    .delete(schema.workflowPresetGroups)
    .where(
      and(
        eq(schema.workflowPresetGroups.id, groupId),
        eq(schema.workflowPresetGroups.created_by, session.user.id),
      ),
    )
    .returning({ id: schema.workflowPresetGroups.id });

  if (deleted.length === 0) {
    throw createError({ statusCode: 404, message: "Preset group not found or not owned by you" });
  }

  return { success: true };
});
