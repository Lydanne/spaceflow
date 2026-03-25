import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requirePermission } from "~~/server/utils/permission";
import { resolveRepoId } from "~~/server/utils/resolve-repo";
import { z } from "zod";

const bodySchema = z.object({
  is_public: z.boolean().optional(),
});

export default defineEventHandler(async (event) => {
  const { repoId, orgId } = await resolveRepoId(event);
  await requirePermission(event, orgId, "actions:trigger", repoId);

  const presetId = getRouterParam(event, "presetId");
  if (!presetId) {
    throw createError({ statusCode: 400, message: "Missing preset ID" });
  }

  const body = await readValidatedBody(event, bodySchema.parse);
  const db = useDB();

  const [updated] = await db
    .update(schema.workflowPresets)
    .set({
      is_public: body.is_public,
      updated_at: new Date(),
    })
    .where(
      and(
        eq(schema.workflowPresets.id, presetId),
        eq(schema.workflowPresets.repository_id, repoId),
      ),
    )
    .returning({ id: schema.workflowPresets.id });

  if (!updated) {
    throw createError({ statusCode: 404, message: "Preset not found" });
  }

  return { success: true };
});
