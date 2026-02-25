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

}

/**
 * 获取 @spaceflow/core 的版本号
 * 从 process.argv[1]（cli 入口）向上找到 @spaceflow/cli 的 package.json
 * 读取其中声明的 @spaceflow/core 依赖版本，保证 cli 和 core 版本一致
 */
export function getSpaceflowCoreVersion(): string {
  const cliEntryPath = process.argv[1];
  if (cliEntryPath) {
    // cli 入口: .../node_modules/@spaceflow/cli/dist/cli.js → 往上两级是包根目录
    const cliDir = join(cliEntryPath, "..", "..");
    const cliPkgPath = join(cliDir, PACKAGE_JSON);
    if (existsSync(cliPkgPath)) {
      try {
        const cliPkg = JSON.parse(readFileSync(cliPkgPath, "utf-8"));
        if (cliPkg.name === "@spaceflow/cli") {
          const coreVersion = cliPkg.dependencies?.["@spaceflow/core"];
          if (coreVersion) {
            return coreVersion;
          }
        }
      } catch {
        // ignore
      }
    }
  }
  return "latest";
}

/**
 * 确保 .spaceflow 目录及 package.json 存在，并保持 @spaceflow/core 版本与 cli 一致
 * @param spaceflowDir .spaceflow 目录路径
 */
export function ensureSpaceflowPackageJson(spaceflowDir: string): void {
  ensureSpaceflowDir(spaceflowDir);

  const packageJsonPath = join(spaceflowDir, PACKAGE_JSON);
  const coreVersion = getSpaceflowCoreVersion();

  if (existsSync(packageJsonPath)) {
    // 已存在：检查并更新 @spaceflow/core 版本
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      if (pkg.dependencies?.["@spaceflow/core"] !== coreVersion) {
        pkg.dependencies = pkg.dependencies || {};
        pkg.dependencies["@spaceflow/core"] = coreVersion;
        writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n");
      }
    } catch {
      // ignore
    }
  } else {
    // 不存在：创建
    const packageJson = {
      name: "spaceflow",
      private: true,
      dependencies: {
        "@spaceflow/core": coreVersion,
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
