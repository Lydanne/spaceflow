import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { parse as parseYaml } from "yaml";
import { schema, useDB } from "~~/server/db";
import { ensureAgentRuntimeGlobalsDefaults } from "~~/server/services/agent-runtime-globals.service";
import { type GiteaRepoContent, type GiteaService, useGiteaSdk } from "~~/server/utils/gitea";
import { requirePermission } from "~~/server/utils/permission";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

interface OpencodeAgentOption {
  id: string;
  label: string;
  description: string | null;
  source: "project" | "global";
  source_label: string;
}

function parseAgentDescriptionFromMarkdown(markdown: string): string | null {
  const frontmatterMatch = markdown.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatterMatch?.[1]) return null;

  try {
    const parsed = parseYaml(frontmatterMatch[1]);
    if (!parsed || typeof parsed !== "object") return null;
    const description = String((parsed as Record<string, unknown>).description || "").trim();
    return description || null;
  } catch {
    return null;
  }
}

function toAgentName(filename: string): string {
  return filename.replace(/\.md$/i, "").trim();
}

async function listProjectOpencodeAgents(params: {
  owner: string;
  repo: string;
  ref: string;
  gitea: GiteaService;
}): Promise<OpencodeAgentOption[]> {
  const listing = await params.gitea.getRepoContents(
    params.owner,
    params.repo,
    ".opencode/agents",
    params.ref,
  );
  const rows: GiteaRepoContent[] = Array.isArray(listing)
    ? listing
    : listing
      ? [listing]
      : [];

  const files = rows
    .filter((item) => item.type === "file" && /\.md$/i.test(item.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  const options: OpencodeAgentOption[] = [];
  for (const file of files) {
    const id = toAgentName(file.name);
    if (!id) continue;

    const content = await params.gitea.getFileContent(
      params.owner,
      params.repo,
      file.path,
      params.ref,
    );

    options.push({
      id,
      label: id,
      description: content ? parseAgentDescriptionFromMarkdown(content) : null,
      source: "project",
      source_label: `项目(${params.ref})`,
    });
  }

  return options;
}

async function listGlobalOpencodeAgents(): Promise<{ dir: string; options: OpencodeAgentOption[] }> {
  const globals = await ensureAgentRuntimeGlobalsDefaults();
  const dir = globals.opencodeAgentsDir;
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = entries
    .filter((entry) => entry.isFile() && /\.md$/i.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  const options: OpencodeAgentOption[] = [];
  for (const file of files) {
    const id = toAgentName(file.name);
    if (!id) continue;

    const filePath = join(dir, file.name);
    const content = await readFile(filePath, "utf8").catch(() => "");
    options.push({
      id,
      label: id,
      description: content ? parseAgentDescriptionFromMarkdown(content) : null,
      source: "global",
      source_label: "全局",
    });
  }

  return { dir, options };
}

export default defineEventHandler(async (event) => {
  const { repoId, orgId, owner, repo } = await resolveRepoId(event);
  await requirePermission(event, orgId, "agent:create", repoId);
  const db = useDB();
  const query = getQuery(event);
  const queryBranch = Array.isArray(query.branch) ? query.branch[0] : query.branch;

  const [project] = await db
    .select({ default_branch: schema.repositories.default_branch })
    .from(schema.repositories)
    .where(and(eq(schema.repositories.id, repoId), eq(schema.repositories.organization_id, orgId)))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const branch = String(queryBranch || "").trim()
    || String(project.default_branch || "").trim()
    || "main";
  const gitea = await useGiteaSdk(event).role("user");

  const [projectOptions, globalResult] = await Promise.all([
    listProjectOpencodeAgents({
      owner,
      repo,
      ref: branch,
      gitea,
    }).catch(() => []),
    listGlobalOpencodeAgents().catch(() => ({ dir: "", options: [] })),
  ]);

  // 项目级优先；同名 agent 仅展示一个。
  const merged = new Map<string, OpencodeAgentOption>();
  for (const option of projectOptions) {
    merged.set(option.id, option);
  }
  for (const option of globalResult.options) {
    if (merged.has(option.id)) continue;
    merged.set(option.id, option);
  }

  return {
    data: Array.from(merged.values()).sort((a, b) => a.label.localeCompare(b.label)),
    project_branch: branch,
    project_count: projectOptions.length,
    global_count: globalResult.options.length,
    global_agents_dir: globalResult.dir,
  };
});
