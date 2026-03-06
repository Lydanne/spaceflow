import { eq } from "drizzle-orm";
import { parse as parseYaml } from "yaml";
import { useDB, schema } from "~~/server/db";
import { requirePermission } from "~~/server/utils/permission";
import { createServiceGiteaClient } from "~~/server/utils/gitea";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

interface WorkflowInput {
  description?: string;
  required?: boolean;
  default?: string;
  type?: string;
  options?: string[];
}

function parseWorkflowYaml(yamlContent: string) {
  try {
    const doc = parseYaml(yamlContent);
    if (!doc || typeof doc !== "object") return null;
    return doc as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractTriggers(doc: Record<string, unknown>): string[] {
  const on = doc.on;
  if (!on) return [];
  if (typeof on === "string") return [on];
  if (Array.isArray(on)) return on.filter((v) => typeof v === "string");
  if (typeof on === "object") return Object.keys(on as Record<string, unknown>);
  return [];
}

function extractSchedules(doc: Record<string, unknown>): string[] {
  const on = doc.on;
  if (!on || typeof on !== "object") return [];
  const schedule = (on as Record<string, unknown>).schedule;
  if (!schedule) return [];
  if (!Array.isArray(schedule)) return [];
  return schedule
    .map((item) =>
      item && typeof item === "object" ? (item as Record<string, string>).cron : null,
    )
    .filter((v): v is string => typeof v === "string");
}

function extractInputs(doc: Record<string, unknown>): Record<string, WorkflowInput> | null {
  const on = doc.on;
  if (!on || typeof on !== "object") return null;
  const dispatch = (on as Record<string, unknown>).workflow_dispatch;
  if (!dispatch || typeof dispatch !== "object") return null;
  const inputs = (dispatch as Record<string, unknown>).inputs;
  if (!inputs || typeof inputs !== "object") return null;
  return inputs as Record<string, WorkflowInput>;
}

export default defineEventHandler(async (event) => {
  const { repoId, orgId, owner, repo } = await resolveRepoId(event);
  await requirePermission(event, orgId, "actions:view", repoId);

  const db = useDB();
  const [project] = await db
    .select()
    .from(schema.repositories)
    .where(eq(schema.repositories.id, repoId))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const gitea = await createServiceGiteaClient();

  try {
    const result = await gitea.getRepoWorkflows(owner, repo);
    const workflows = result.workflows || [];

    // 并行获取每个 workflow 的文件内容以解析 inputs
    const data = await Promise.all(
      workflows.map(async (w) => {
        const content = await gitea.getFileContent(owner, repo, w.path);
        const doc = content ? parseWorkflowYaml(content) : null;
        const inputs = doc ? extractInputs(doc) : null;
        const triggers = doc ? extractTriggers(doc) : [];
        const schedules = doc ? extractSchedules(doc) : [];
        const description = doc?.["x-description"] as string | undefined;
        return {
          id: w.id,
          name: w.name,
          path: w.path,
          state: w.state,
          description: description || "",
          triggers,
          schedules,
          inputs: inputs || {},
        };
      }),
    );

    return { data };
  } catch {
    return { data: [] };
  }
});
