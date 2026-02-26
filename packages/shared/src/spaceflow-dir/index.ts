import { existsSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { createRequire } from "module";
import { homedir } from "os";
import { detectPackageManager } from "../package-manager";

/** .spaceflow 目录名 */
export const SPACEFLOW_DIR = ".spaceflow";

/** package.json 文件名 */
export const PACKAGE_JSON = "package.json";

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
bin/
`;
    writeFileSync(gitignorePath, gitignoreContent);
  }
}

/**
 * 获取 @spaceflow/core 的版本号
 * 1. 读取当前目录 package.json，若 @spaceflow/cli 为 workspace:* 则为开发模式，返回 workspace:*
 * 2. 否则从 process.argv[1]（cli 入口）向上找 @spaceflow/cli 的 package.json
 *    读取其中声明的 @spaceflow/core 依赖版本，保证 cli 和 core 版本一致
 */
export function getSpaceflowCoreVersion(): string {
  // 读取当前目录 package.json，如果 @spaceflow/cli 是 workspace:* 则为开发模式
  const rootPkgPath = join(process.cwd(), PACKAGE_JSON);
  if (existsSync(rootPkgPath)) {
    try {
      const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf-8"));
      const cliVersion =
        rootPkg.devDependencies?.["@spaceflow/cli"] ?? rootPkg.dependencies?.["@spaceflow/cli"];
      if (cliVersion === "workspace:*") {
        return "workspace:*";
      }
    } catch {
      // ignore
    }
  }

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
      type: "module",
      dependencies: {
        "@spaceflow/core": coreVersion,
      },
    };
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
  }
}

/**
 * 确保 .spaceflow/node_modules 已安装
 * @param spaceflowDir .spaceflow 目录路径
 */
export function ensureDependencies(spaceflowDir: string): void {
  const nodeModulesDir = join(spaceflowDir, "node_modules");
  const packageJsonPath = join(spaceflowDir, PACKAGE_JSON);

  if (!existsSync(packageJsonPath) || existsSync(nodeModulesDir)) {
    return;
  }

  const pm = detectPackageManager(spaceflowDir);
  try {
    execSync(`${pm} install`, { cwd: spaceflowDir, stdio: "inherit" });
  } catch {
    console.warn(`⚠ ${pm} install 失败，部分扩展可能无法加载`);
  }
}

/**
 * 从 .spaceflow 目录加载外部扩展模块
 * @param spaceflowDir .spaceflow 目录路径
 * @param names 扩展包名列表
 * @returns 加载成功的扩展定义列表
 */
export async function loadExtensionsFromDir(spaceflowDir: string, names: string[]): Promise<any[]> {
  const packageJsonPath = join(spaceflowDir, PACKAGE_JSON);

  if (!existsSync(packageJsonPath)) {
    return [];
  }

  const extensions: any[] = [];
  for (const name of names) {
    try {
      const localRequire = createRequire(packageJsonPath);
      const resolvedPath = localRequire.resolve(name);
      const dynamicImport = new Function("url", "return import(url)");
      const mod = await dynamicImport(`file://${resolvedPath}`);
      const ext = mod.default || mod.extension || mod;
      if (ext) {
        extensions.push(ext);
      }
    } catch (err) {
      console.warn(`⚠ 无法加载扩展 ${name}:`, (err as Error).message);
    }
  }
  return extensions;
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
