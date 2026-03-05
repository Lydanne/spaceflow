import { eq, and } from "drizzle-orm";
import { useDB, schema } from "../../../../../../db";
import { requireOrgAccess } from "../../../../../../utils/org-access";
import { createGiteaService } from "../../../../../../utils/gitea";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  const projectId = getRouterParam(event, "projectId");
  if (!orgId || !projectId) {
    throw createError({ statusCode: 400, message: "Missing orgId or projectId" });
  }
  const session = await requireOrgAccess(event, orgId);
  const db = useDB();

  const [project] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, projectId), eq(schema.projects.organizationId, orgId)))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const body = await readBody(event);
  const { branch } = body as { branch?: string };
  const targetBranch = branch || project.defaultBranch || "main";

  // 获取最新 commit
  const gitea = createGiteaService(session.giteaAccessToken);
  const parts = project.fullName.split("/");
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw createError({ statusCode: 500, message: "Invalid project fullName format" });
  }

  let commitSha = "";
  let commitMessage = "";
  try {
    const commits = await gitea.getRepoCommits(parts[0], parts[1], targetBranch, 1);
    if (commits.length > 0) {
      commitSha = commits[0]!.sha;
      commitMessage = commits[0]!.commit.message;
    }
  } catch {
    throw createError({ statusCode: 500, message: "Failed to fetch latest commit from Gitea" });
  }

  if (!commitSha) {
    throw createError({ statusCode: 400, message: "No commits found on branch" });
  }

  const [task] = await db
    .insert(schema.publishTasks)
    .values({
      projectId: project.id,
      branch: targetBranch,
      commitSha,
      commitMessage,
      triggeredBy: session.user.id,
      triggerType: "manual",
      status: "pending",
    })
    .returning();

  // TODO: Phase 2 Week 4 - 将任务推入 BullMQ 队列

  return task;
});
