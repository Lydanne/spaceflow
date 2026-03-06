import { requireOrgAccess } from "~~/server/utils/org-access";
import { createServiceGiteaClient } from "~~/server/utils/gitea";
import { resolveOrgId } from "~~/server/utils/resolve-org";

export default defineEventHandler(async (event) => {
  const { orgId, orgName } = await resolveOrgId(event);
  await requireOrgAccess(event, orgId);

  const query = getQuery(event);
  const search = query.q as string | undefined;
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));

  const gitea = await createServiceGiteaClient();

  const repos = search
    ? await gitea.searchRepos(orgName, search, limit)
    : await gitea.getOrgRepos(orgName, page, limit);

  return { data: repos };
});
