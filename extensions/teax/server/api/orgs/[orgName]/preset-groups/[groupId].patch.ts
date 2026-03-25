import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { resolveOrgId } from "~~/server/utils/resolve-org";
import { requireOrgOwnerOrAdmin } from "~~/server/utils/org-owner";
import { z } from "zod";

const updatePresetGroupVisibilityBodySchema = z.object({
  is_public: z.boolean(),
});

/**
 * 更新预设组的公开状态（仅管理员可操作）
 */
export default defineEventHandler(async (event) => {
  const { orgId } = await resolveOrgId(event);
  await requireOrgOwnerOrAdmin(event, orgId);
  const db = useDB();

  const groupId = getRouterParam(event, "groupId");
  if (!groupId) {
    throw createError({ statusCode: 400, message: "Missing group ID" });
  }

  const body = await readValidatedBody(event, updatePresetGroupVisibilityBodySchema.parse);

  const [updated] = await db
    .update(schema.workflowPresetGroups)
    .set({
      is_public: body.is_public,
      updated_at: new Date(),
    })
    .where(
      and(
        eq(schema.workflowPresetGroups.id, groupId),
        eq(schema.workflowPresetGroups.organization_id, orgId),
      ),
    )
    .returning({
      id: schema.workflowPresetGroups.id,
      is_public: schema.workflowPresetGroups.is_public,
    });

  if (!updated) {
    throw createError({ statusCode: 404, message: "Preset group not found" });
  }

  return { success: true, group: updated };
});
