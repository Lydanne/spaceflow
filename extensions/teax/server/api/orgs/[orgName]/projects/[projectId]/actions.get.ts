import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requirePermission } from "~~/server/utils/permission";
import { createServiceGiteaClient } from "~~/server/utils/gitea";
import { resolveOrgId } from "~~/server/utils/resolve-org";

export default defineEventHandler(async (event) => {
  const { orgId } = await resolveOrgId(event);
  const projectId = getRouterParam(event, "projectId")!;
  await requirePermission(event, orgId, "actions:view", projectId);
  const query = getQuery(event);
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;

  const db = useDB();
  const [project] = await db
    .select()
    .from(schema.repositories)
    .where(eq(schema.repositories.id, projectId))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const gitea = await createServiceGiteaClient();
  const parts = project.full_name.split("/");
  const owner = parts[0] ?? "";
  const repo = parts[1] ?? "";

  try {
    const result = await gitea.getRepoWorkflowRuns(owner, repo, page, limit);
    return {
      total: result.total_count,
      data: (result.workflow_runs || []).map((run) => ({
        id: run.id,
        runNumber: run.run_number,
        displayTitle: run.display_title,
        status: run.status,
        conclusion: run.conclusion,
        event: run.event,
        headBranch: run.head_branch,
        headSha: run.head_sha,
        path: run.path,
        htmlUrl: run.html_url,
        startedAt: run.started_at,
        completedAt: run.completed_at,
        actor: run.actor ? { login: run.actor.login, avatar_url: run.actor.avatar_url } : null,
      })),
    };
  } catch {
    // Gitea Actions 可能未启用
    return { total: 0, data: [] };
  }
});
