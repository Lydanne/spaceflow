import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requirePermission } from "~~/server/utils/permission";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

export default defineEventHandler(async (event) => {
  const { repoId, orgId } = await resolveRepoId(event);
  await requirePermission(event, orgId, "actions:trigger", repoId);

  const presetId = getRouterParam(event, "presetId");
  if (!presetId) {
    throw createError({ statusCode: 400, message: "Missing preset ID" });
  }

  const db = useDB();

  const [deleted] = await db
    .delete(schema.workflowPresets)
    .where(
      and(
        eq(schema.workflowPresets.id, presetId),
        eq(schema.workflowPresets.repository_id, repoId),
      ),
    )
    .returning({ id: schema.workflowPresets.id });

  if (!deleted) {
    throw createError({ statusCode: 404, message: "Preset not found" });
  }

  return { success: true };
});
