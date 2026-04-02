import { createAgentSessionBodySchema } from "~~/server/shared/dto";
import { createAgentSession } from "~~/server/services/agent-session.service";
import { requirePermission } from "~~/server/utils/permission";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

export default defineEventHandler(async (event) => {
  const { repoId, orgId } = await resolveRepoId(event);
  const session = await requirePermission(event, orgId, "agent:create", repoId);
  const body = await readValidatedBody(event, createAgentSessionBodySchema.parse);

  return createAgentSession({
    repositoryId: repoId,
    creatorId: session.user.id,
    title: body.title,
    prompt: body.prompt,
    visibility: body.visibility,
    baseBranch: body.base_branch,
    workingBranch: body.working_branch,
    autoCommit: body.auto_commit,
    autoPr: body.auto_pr,
  });
});
