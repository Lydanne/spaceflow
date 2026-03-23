import { useDB, schema } from "~~/server/db";
import { requirePermission } from "~~/server/utils/permission";
import { resolveRepoId } from "~~/server/utils/resolve-repo";
import { createWorkflowPresetBodySchema } from "~~/server/shared/dto";
import { nanoid } from "nanoid";

export default defineEventHandler(async (event) => {
  const { repoId, orgId } = await resolveRepoId(event);
  const session = await requirePermission(event, orgId, "actions:trigger", repoId);

  const body = await readValidatedBody(event, createWorkflowPresetBodySchema.parse);
  const db = useDB();

  const shareToken = nanoid(16);

  const [preset] = await db
    .insert(schema.workflowPresets)
    .values({
      repository_id: repoId,
      name: body.name,
      workflow_path: body.workflow_path,
      branch: body.branch,
      inputs: body.inputs,
      share_token: shareToken,
      allow_input_override: body.allow_input_override,
      locked_inputs: body.locked_inputs,
      allow_branch_override: body.allow_branch_override,
      created_by: session.user.id,
    })
    .returning();

  return preset;
});
