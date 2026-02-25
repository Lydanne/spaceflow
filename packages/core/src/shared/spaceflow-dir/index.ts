import { existsSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { SPACEFLOW_DIR, PACKAGE_JSON } from "../../extension-system/extension.interface";

/**
 * 获取 .spaceflow 目录路径
 * @param isGlobal 是否为全局目录（~/.spaceflow）
 * @param cwd 工作目录，默认为 process.cwd()
 */
export function getSpaceflowDir(isGlobal: boolean, cwd?: string): string {
  if (isGlobal) {
    return join(homedir(), SPACEFLOW_DIR);
  }
  return join(cwd || process.cwd(), SPACEFLOW_DIR);
}

/**
 * 确保 .spaceflow 目录存在
 * @param spaceflowDir .spaceflow 目录路径
 */
export function ensureSpaceflowDir(spaceflowDir: string): void {
  if (!existsSync(spaceflowDir)) {
    mkdirSync(spaceflowDir, { recursive: true });
  }

  // 创建 .gitignore
  const gitignorePath = join(spaceflowDir, ".gitignore");
  if (!existsSync(gitignorePath)) {
    const gitignoreContent = `# Spaceflow Extension dependencies
node_modules/
pnpm-lock.yaml
config-schema.json
`;
    writeFileSync(gitignorePath, gitignoreContent);
  }

  // 创建空的 pnpm-workspace.yaml，防止被父级 workspace 接管
  const workspaceYamlPath = join(spaceflowDir, "pnpm-workspace.yaml");
  if (!existsSync(workspaceYamlPath)) {
    writeFileSync(workspaceYamlPath, "packages: []\n");
  }
}

/**
 * 获取 @spaceflow/cli 的路径
 * @param isGlobal 是否为全局安装
 * @param cwd 工作目录，默认为 process.cwd()
 */
export function getSpaceflowCliPath(isGlobal: boolean = false, cwd?: string): string {
  const workDir = cwd || process.cwd();

  if (isGlobal) {
    // 全局安装：尝试找到 @spaceflow/cli 的实际路径进行 link
    // 优先从当前项目的 cli 目录 link
    const cliPath = join(workDir, "packages", "cli");
    if (existsSync(join(cliPath, PACKAGE_JSON))) {
      try {
        const content = readFileSync(join(cliPath, PACKAGE_JSON), "utf-8");
        const pkg = JSON.parse(content);
        if (pkg.name === "@spaceflow/cli") {
          return `link:${cliPath}`;
        }
      } catch {
        // ignore
      }
    }
    // 回退到 latest
    return "latest";
  }

  // 尝试从项目 package.json 获取版本
  const projectPkgPath = join(workDir, PACKAGE_JSON);
  if (existsSync(projectPkgPath)) {
    try {
      const content = readFileSync(projectPkgPath, "utf-8");
      const pkg = JSON.parse(content);
      const version =
        pkg.dependencies?.["@spaceflow/core"] || pkg.devDependencies?.["@spaceflow/core"];
      if (version) {
        // workspace:* 不能直接用于 .spaceflow（它有独立的 pnpm-workspace.yaml）
        // 需要转换为 link: 指向实际的 core 包路径
        if (version.startsWith("workspace:")) {
          const corePath = join(workDir, "packages", "core");
          if (existsSync(join(corePath, PACKAGE_JSON))) {
            try {
              const coreContent = readFileSync(join(corePath, PACKAGE_JSON), "utf-8");
              const corePkg = JSON.parse(coreContent);
              if (corePkg.name === "@spaceflow/core") {
                return `link:${corePath}`;
              }
            } catch {
              // ignore
            }
          }
          // workspace 引用但找不到本地 core 包，回退到 latest
          return "latest";
        }
        return version;
      }
    } catch {
      // ignore
    }
  }

  return "latest";
}

/**
 * 确保 .spaceflow/package.json 存在
 * 包含 @spaceflow/cli 作为依赖
 * @param spaceflowDir .spaceflow 目录路径
 * @param isGlobal 是否为全局安装
 * @param cwd 工作目录，默认为 process.cwd()
 */
export function ensureSpaceflowPackageJson(
  spaceflowDir: string,
  isGlobal: boolean = false,
  cwd?: string,
): void {
  // 确保目录存在
  ensureSpaceflowDir(spaceflowDir);

  // 确保 package.json 存在
  const packageJsonPath = join(spaceflowDir, PACKAGE_JSON);
  if (!existsSync(packageJsonPath)) {
    const cliPath = getSpaceflowCliPath(isGlobal, cwd);
    const packageJson = {
      name: "spaceflow",
      private: true,
      dependencies: {
        "@spaceflow/core": cliPath,
      },
    };
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
  }
}

/**
 * 确保编辑器目录有 .gitignore 文件，并将生成的文件加入忽略列表
 * @param editorRoot 编辑器根目录（如 .claude）
 * @param itemType 项目类型 (skills 或 commands)
 * @param itemName 项目名称
 */
export async function ensureEditorGitignore(
  editorRoot: string,
  itemType: "skills" | "commands",
  itemName: string,
): Promise<void> {
  const { readFile, writeFile } = await import("fs/promises");
  const gitignorePath = join(editorRoot, ".gitignore");
  const ignoreEntry = itemType === "skills" ? `skills/${itemName}` : `commands/${itemName}.md`;

  let content = "";
  if (existsSync(gitignorePath)) {
    content = await readFile(gitignorePath, "utf-8");
    // 检查是否已包含该条目
    const lines = content.split("\n").map((l) => l.trim());
    if (lines.includes(ignoreEntry)) {
      return;
    }
    // 确保末尾有换行
    if (!content.endsWith("\n")) {
      content += "\n";
    }
  } else {
    content = "# 自动生成的 .gitignore - spaceflow 安装的 skills 和 commands\n";
  }

  content += `${ignoreEntry}\n`;
  await writeFile(gitignorePath, content);
}
