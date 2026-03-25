import { useDB, schema } from "~~/server/db";
import { requirePermission } from "~~/server/utils/permission";
import { resolveRepoId } from "~~/server/utils/resolve-repo";
import { createWorkflowPresetBodySchema } from "~~/server/shared/dto";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const { repoId, orgId } = await resolveRepoId(event);
  const session = await requirePermission(event, orgId, "actions:trigger", repoId);

  const body = await readValidatedBody(event, createWorkflowPresetBodySchema.parse);
  const db = useDB();

  // 获取仓库的 organization_id
  const [repo] = await db
    .select({ organization_id: schema.repositories.organization_id })
    .from(schema.repositories)
    .where(eq(schema.repositories.id, repoId))
    .limit(1);

  if (!repo) {
    throw createError({ statusCode: 404, message: "Repository not found" });
  }

  const shareToken = nanoid(16);

  const [preset] = await db
    .insert(schema.workflowPresets)
    .values({
      repository_id: repoId,
      organization_id: repo.organization_id,
      name: body.name,
      workflow_path: body.workflow_path,
      branch: body.branch,
      inputs: body.inputs,
      share_token: shareToken,
      allow_input_override: body.allow_input_override,
      locked_inputs: body.locked_inputs,
      allow_branch_override: body.allow_branch_override,
      allow_sync_override: body.allow_sync_override,
      is_public: body.is_public,
      created_by: session.user.id,
    })
    .returning();

  return preset;
});
