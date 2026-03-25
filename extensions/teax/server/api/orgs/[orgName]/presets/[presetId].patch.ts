import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { resolveOrgId } from "~~/server/utils/resolve-org";
import { requireOrgOwnerOrAdmin } from "~~/server/utils/org-owner";
import { z } from "zod";

const updatePresetVisibilityBodySchema = z.object({
  is_public: z.boolean(),
});

/**
 * 更新预设的公开状态（仅管理员或创建者可操作）
 */
export default defineEventHandler(async (event) => {
  const { orgId } = await resolveOrgId(event);
  await requireOrgOwnerOrAdmin(event, orgId);
  const db = useDB();

  const presetId = getRouterParam(event, "presetId");
  if (!presetId) {
    throw createError({ statusCode: 400, message: "Missing preset ID" });
  }

  const body = await readValidatedBody(event, updatePresetVisibilityBodySchema.parse);

  const [updated] = await db
    .update(schema.workflowPresets)
    .set({
      is_public: body.is_public,
      updated_at: new Date(),
    })
    .where(
      and(
        eq(schema.workflowPresets.id, presetId),
        eq(schema.workflowPresets.organization_id, orgId),
      ),
    )
    .returning({
      id: schema.workflowPresets.id,
      is_public: schema.workflowPresets.is_public,
    });

  if (!updated) {
    throw createError({ statusCode: 404, message: "Preset not found" });
  }

  return { success: true, preset: updated };
});
