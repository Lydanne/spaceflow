import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";
import { createPresetGroupBodySchema } from "~~/server/shared/dto";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";

/**
 * 创建预设组
 */
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const body = await readValidatedBody(event, createPresetGroupBodySchema.parse);
  const db = useDB();

  // 验证仓库存在并获取 organization_id
  const [repo] = await db
    .select({
      id: schema.repositories.id,
      organization_id: schema.repositories.organization_id,
    })
    .from(schema.repositories)
    .where(eq(schema.repositories.id, body.repository_id));

  if (!repo) {
    throw createError({ statusCode: 404, message: "Repository not found" });
  }

  // 创建预设组（不自动创建子预设，由用户手动添加）
  const groupToken = nanoid(16);
  const [group] = await db
    .insert(schema.workflowPresetGroups)
    .values({
      repository_id: body.repository_id,
      organization_id: repo.organization_id,
      name: body.name,
      description: body.description || null,
      workflow_path: body.workflow_path,
      default_branch: body.default_branch,
      default_inputs: body.default_inputs || {},
      auto_unlock_minutes: body.auto_unlock_minutes ?? 60,
      share_token: groupToken,
      is_public: body.is_public,
      created_by: session.user.id,
    })
    .returning();

  return {
    success: true,
    group: {
      id: group!.id,
      name: group!.name,
      share_token: group!.share_token,
      is_public: group!.is_public,
    },
  };
});
