import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { isAbsolute, join, posix, resolve } from "node:path";
import { ensureRuntimeTeaxDefaultsSynced } from "~~/server/services/agent-runtime-defaults.service";

export interface AgentRuntimeGlobalsPaths {
  rootDir: string;
  teaxDir: string;
  globalsDir: string;
  globalsDockerfilePath: string;
  opencodeDir: string;
  opencodeConfigPath: string;
  opencodeAgentsDir: string;
  opencodeSkillsDir: string;
  opencodeMcpDir: string;
  dockerWorkspaceRoot: string;
  containerTeaxDir: string;
  containerGlobalsDir: string;
  containerOpencodeDir: string;
  containerRootConfigDir: string;
  containerNodeConfigDir: string;
}

// 全局 Dockerfile 模板：供每个仓库 runtime 镜像继承，保持最小可运行基线。
const DEFAULT_GLOBALS_DOCKERFILE = [
  "FROM teax-agent-runtime:base",
  "WORKDIR /runtime",
  "CMD [\"sleep\", \"infinity\"]",
  "",
].join("\n");

// 全局 opencode 默认配置：先给出空 agent/mcp 结构，便于后续按需增量配置。
const DEFAULT_GLOBALS_OPENCODE_CONFIG = `${JSON.stringify({
  $schema: "https://opencode.ai/config.json",
  agent: {},
  mcp: {},
}, null, 2)}\n`;

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function withTrailingEol(value: string): string {
  // 写回文本文件时统一补齐末尾换行，避免 diff 抖动与拼接问题。
  return value.endsWith("\n") ? value : `${value}\n`;
}

export function resolveAgentRuntimeGlobalsPaths(): AgentRuntimeGlobalsPaths {
  const config = useRuntimeConfig();
  // 与 runtime 主配置一致：支持绝对路径与相对项目根路径。
  const rawRoot = String(config.agent.runtimeRoot || ".teax-agent-runtime");
  const rootDir = isAbsolute(rawRoot) ? rawRoot : resolve(process.cwd(), rawRoot);
  const dockerWorkspaceRoot = String(config.agent.runtimeDockerWorkspaceRoot || "/runtime").trim() || "/runtime";
  const teaxDir = join(rootDir, ".teax");
  const globalsDir = join(teaxDir, "globals");
  const opencodeDir = join(globalsDir, "opencode");
  const containerTeaxDir = posix.join(dockerWorkspaceRoot, ".teax");
  const containerGlobalsDir = posix.join(containerTeaxDir, "globals");
  const containerOpencodeDir = posix.join(containerGlobalsDir, "opencode");

  // 同时返回“宿主机路径 + 容器内路径”，供构建和运行阶段统一复用。
  return {
    rootDir,
    teaxDir,
    globalsDir,
    globalsDockerfilePath: join(globalsDir, "Dockerfile"),
    opencodeDir,
    opencodeConfigPath: join(opencodeDir, "opencode.json"),
    opencodeAgentsDir: join(opencodeDir, "agents"),
    opencodeSkillsDir: join(opencodeDir, "skills"),
    opencodeMcpDir: join(opencodeDir, "mcp"),
    dockerWorkspaceRoot,
    containerTeaxDir,
    containerGlobalsDir,
    containerOpencodeDir,
    containerRootConfigDir: "/root/.config/opencode",
    containerNodeConfigDir: "/home/node/.config/opencode",
  };
}

export async function ensureAgentRuntimeGlobalsDefaults(): Promise<AgentRuntimeGlobalsPaths> {
  await ensureRuntimeTeaxDefaultsSynced();
  const paths = resolveAgentRuntimeGlobalsPaths();
  await mkdir(paths.globalsDir, { recursive: true });
  await mkdir(paths.opencodeDir, { recursive: true });
  await mkdir(paths.opencodeAgentsDir, { recursive: true });
  await mkdir(paths.opencodeSkillsDir, { recursive: true });
  await mkdir(paths.opencodeMcpDir, { recursive: true });

  if (!await pathExists(paths.globalsDockerfilePath)) {
    // 仅在缺失时写入默认值，避免覆盖管理员在界面上的自定义内容。
    await writeFile(paths.globalsDockerfilePath, DEFAULT_GLOBALS_DOCKERFILE);
  }
  if (!await pathExists(paths.opencodeConfigPath)) {
    // opencode 配置同样采用“缺失补齐”策略。
    await writeFile(paths.opencodeConfigPath, DEFAULT_GLOBALS_OPENCODE_CONFIG);
  }

  return paths;
}

export async function readAgentRuntimeGlobalsFiles() {
  const paths = await ensureAgentRuntimeGlobalsDefaults();
  const [dockerfile, opencodeConfig] = await Promise.all([
    readFile(paths.globalsDockerfilePath, "utf8"),
    readFile(paths.opencodeConfigPath, "utf8"),
  ]);
  return {
    paths,
    dockerfile,
    opencodeConfig,
  };
}

export async function updateAgentRuntimeGlobalsFiles(params: {
  dockerfile?: string;
  opencodeConfig?: string;
}) {
  const paths = await ensureAgentRuntimeGlobalsDefaults();

  if (params.dockerfile !== undefined) {
    const dockerfile = String(params.dockerfile || "");
    if (!dockerfile.trim()) {
      // Dockerfile 为空会导致后续镜像构建不可用，这里直接拒绝。
      throw createError({ statusCode: 400, message: "Dockerfile content cannot be empty" });
    }
    await writeFile(paths.globalsDockerfilePath, withTrailingEol(dockerfile));
  }

  if (params.opencodeConfig !== undefined) {
    const opencodeConfig = String(params.opencodeConfig || "");
    if (!opencodeConfig.trim()) {
      // 配置文件允许“空对象”，但不允许完全空文本，避免误删。
      throw createError({ statusCode: 400, message: "Opencode config content cannot be empty" });
    }
    try {
      JSON.parse(opencodeConfig);
    } catch {
      // 在写入前做 JSON 语法校验，避免 runtime 启动时才暴露配置错误。
      throw createError({ statusCode: 400, message: "Opencode config must be valid JSON" });
    }
    await writeFile(paths.opencodeConfigPath, withTrailingEol(opencodeConfig));
  }

  return readAgentRuntimeGlobalsFiles();
}
