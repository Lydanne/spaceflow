import { resolveRepoId } from "~~/server/utils/resolve-repo";
import { requirePermission } from "~~/server/utils/permission";
import { getApprovalsByRepo } from "~~/server/services/approval.service";

export default defineEventHandler(async (event) => {
  const { repoId, orgId } = await resolveRepoId(event);
  await requirePermission(event, orgId, "actions:view", repoId);

  const query = getQuery(event);
  const status = (query.status as string) || undefined;

  const approvals = await getApprovalsByRepo(repoId, status);

  return { data: approvals };
});
