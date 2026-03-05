import { eq } from "drizzle-orm";
import { useDB, schema } from "../../../db";
import { requireOrgAccess } from "../../../utils/org-access";
import { createGiteaService } from "../../../utils/gitea";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  if (!orgId) {
    throw createError({ statusCode: 400, message: "Missing orgId" });
  }
  const session = await requireOrgAccess(event, orgId);
  const db = useDB();

  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, orgId))
    .limit(1);

  if (!org) {
    throw createError({ statusCode: 404, message: "Organization not found" });
  }

  const query = getQuery(event);
  const search = query.q as string | undefined;
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));

  const gitea = createGiteaService(session.giteaAccessToken);

  const repos = search
    ? await gitea.searchRepos(org.name, search, limit)
    : await gitea.getOrgRepos(org.name, page, limit);

  return { data: repos };
});
