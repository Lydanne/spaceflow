import { eq } from "drizzle-orm";
import { useDB, schema } from "../../../../../db";
import { requireOrgAccess } from "../../../../../utils/org-access";
import { createGiteaService } from "../../../../../utils/gitea";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId")!;
  const session = await requireOrgAccess(event, orgId);
  const projectId = getRouterParam(event, "projectId")!;

  const db = useDB();
  const [project] = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const gitea = createGiteaService(session.giteaAccessToken);
  const parts = project.fullName.split("/");
  const owner = parts[0] ?? "";
  const repo = parts[1] ?? "";

  try {
    const result = await gitea.getRepoWorkflows(owner, repo);
    return {
      data: (result.workflows || []).map(w => ({
        id: w.id,
        name: w.name,
        path: w.path,
        state: w.state,
      })),
    };
  } catch {
    return { data: [] };
  }
});
