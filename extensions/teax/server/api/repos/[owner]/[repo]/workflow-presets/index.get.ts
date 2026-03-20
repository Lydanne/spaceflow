import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requirePermission } from "~~/server/utils/permission";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

export default defineEventHandler(async (event) => {
  const { repoId, orgId } = await resolveRepoId(event);
  await requirePermission(event, orgId, "actions:view", repoId);

  const db = useDB();

  const presets = await db
    .select({
      id: schema.workflowPresets.id,
      name: schema.workflowPresets.name,
      workflow_path: schema.workflowPresets.workflow_path,
      branch: schema.workflowPresets.branch,
      inputs: schema.workflowPresets.inputs,
      share_token: schema.workflowPresets.share_token,
      created_at: schema.workflowPresets.created_at,
    })
    .from(schema.workflowPresets)
    .where(eq(schema.workflowPresets.repository_id, repoId))
    .orderBy(schema.workflowPresets.created_at);

  return { data: presets };
});
