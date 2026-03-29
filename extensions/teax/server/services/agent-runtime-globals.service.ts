import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { isAbsolute, join, posix, resolve } from "node:path";

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

const DEFAULT_GLOBALS_DOCKERFILE = [
  "FROM teax-agent-runtime:base",
  "WORKDIR /runtime",
  "CMD [\"sleep\", \"infinity\"]",
  "",
].join("\n");

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
  return value.endsWith("\n") ? value : `${value}\n`;
}

export function resolveAgentRuntimeGlobalsPaths(): AgentRuntimeGlobalsPaths {
  const config = useRuntimeConfig();
  const rawRoot = String(config.agentRuntimeRoot || ".teax-agent-runtime");
  const rootDir = isAbsolute(rawRoot) ? rawRoot : resolve(process.cwd(), rawRoot);
  const dockerWorkspaceRoot = String(config.agentRuntimeDockerWorkspaceRoot || "/runtime").trim() || "/runtime";
  const teaxDir = join(rootDir, ".teax");
  const globalsDir = join(teaxDir, "globals");
  const opencodeDir = join(globalsDir, "opencode");
  const containerTeaxDir = posix.join(dockerWorkspaceRoot, ".teax");
  const containerGlobalsDir = posix.join(containerTeaxDir, "globals");
  const containerOpencodeDir = posix.join(containerGlobalsDir, "opencode");

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
  const paths = resolveAgentRuntimeGlobalsPaths();
  await mkdir(paths.globalsDir, { recursive: true });
  await mkdir(paths.opencodeDir, { recursive: true });
  await mkdir(paths.opencodeAgentsDir, { recursive: true });
  await mkdir(paths.opencodeSkillsDir, { recursive: true });
  await mkdir(paths.opencodeMcpDir, { recursive: true });

  if (!await pathExists(paths.globalsDockerfilePath)) {
    await writeFile(paths.globalsDockerfilePath, DEFAULT_GLOBALS_DOCKERFILE);
  }
  if (!await pathExists(paths.opencodeConfigPath)) {
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
      throw createError({ statusCode: 400, message: "Dockerfile content cannot be empty" });
    }
    await writeFile(paths.globalsDockerfilePath, withTrailingEol(dockerfile));
  }

  if (params.opencodeConfig !== undefined) {
    const opencodeConfig = String(params.opencodeConfig || "");
    if (!opencodeConfig.trim()) {
      throw createError({ statusCode: 400, message: "Opencode config content cannot be empty" });
    }
    try {
      JSON.parse(opencodeConfig);
    } catch {
      throw createError({ statusCode: 400, message: "Opencode config must be valid JSON" });
    }
    await writeFile(paths.opencodeConfigPath, withTrailingEol(opencodeConfig));
  }

  return readAgentRuntimeGlobalsFiles();
}

