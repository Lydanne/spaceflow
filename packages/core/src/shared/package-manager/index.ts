/**
 * 从 @spaceflow/shared 重导出 package-manager 工具函数
 */
export { getPackageManager, detectPackageManager, isPnpmWorkspace } from "@spaceflow/shared";

// addSpaceflowToDevDependencies 是 core 独有的，保留在这里
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * 将 .spaceflow 添加到根项目的 devDependencies 中
 * 使用 file: 协议，兼容 npm 和 pnpm
 * @param cwd 工作目录，默认为 process.cwd()
 * @returns 是否成功添加（如果已存在则返回 false）
 */
export function addSpaceflowToDevDependencies(cwd?: string): boolean {
  const workDir = cwd || process.cwd();
  const packageJsonPath = join(workDir, "package.json");

  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const content = readFileSync(packageJsonPath, "utf-8");
    const pkg = JSON.parse(content);

    // 检查是否已存在
    if (pkg.devDependencies?.["spaceflow"]) {
      return false;
    }

    // 添加到 devDependencies
    if (!pkg.devDependencies) {
      pkg.devDependencies = {};
    }
    pkg.devDependencies["spaceflow"] = "file:.spaceflow";

    writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n");
    return true;
  } catch {
    return false;
  }
}
