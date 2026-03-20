import { and, eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const db = useDB();

  const presetId = getRouterParam(event, "presetId");
  if (!presetId) {
    throw createError({ statusCode: 400, message: "Missing preset ID" });
  }

  // 只能删除自己创建的预设
  const deleted = await db
    .delete(schema.workflowPresets)
    .where(
      and(
        eq(schema.workflowPresets.id, presetId),
        eq(schema.workflowPresets.created_by, session.user.id),
      ),
    )
    .returning({ id: schema.workflowPresets.id });

  if (deleted.length === 0) {
    throw createError({ statusCode: 404, message: "Preset not found or not owned by you" });
  }

  return { success: true };
});
