import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

/**
 * 检测项目使用的包管理器
 * 必须同时满足：命令可用 AND lock 文件存在
 * @param cwd 工作目录，默认为 process.cwd()
 */
export function getPackageManager(cwd?: string): string {
  const workDir = cwd || process.cwd();

  // pnpm: 命令可用 + pnpm-lock.yaml 存在
  if (existsSync(join(workDir, "pnpm-lock.yaml"))) {
    try {
      execSync("pnpm --version", { stdio: "ignore" });
      return "pnpm";
    } catch {
      // pnpm 命令不可用，继续检测其他
    }
  }

  // yarn: 命令可用 + yarn.lock 存在
  if (existsSync(join(workDir, "yarn.lock"))) {
    try {
      execSync("yarn --version", { stdio: "ignore" });
      return "yarn";
    } catch {
      // yarn 命令不可用，继续检测其他
    }
  }

  // npm: 命令可用 + package-lock.json 存在
  if (existsSync(join(workDir, "package-lock.json"))) {
    try {
      execSync("npm --version", { stdio: "ignore" });
      return "npm";
    } catch {
      // npm 命令不可用
    }
  }

  // 默认回退到 npm
  return "npm";
}

/**
 * 检测指定目录使用的包管理器（基于 lock 文件）
 * 如果没有 lock 文件，尝试检测 pnpm 是否可用
 * @param dir 目标目录
 */
export function detectPackageManager(dir: string): string {
  if (existsSync(join(dir, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (existsSync(join(dir, "yarn.lock"))) {
    return "yarn";
  }
  if (existsSync(join(dir, "package-lock.json"))) {
    return "npm";
  }
  // 默认使用 pnpm（如果可用）
  try {
    execSync("pnpm --version", { stdio: "ignore" });
    return "pnpm";
  } catch {
    return "npm";
  }
}

/**
 * 检测当前目录是否为 pnpm workspace
 * @param cwd 工作目录，默认为 process.cwd()
 */
export function isPnpmWorkspace(cwd?: string): boolean {
  const workDir = cwd || process.cwd();
  return existsSync(join(workDir, "pnpm-workspace.yaml"));
}

/**
 * 将 .spaceflow 添加到根项目的 devDependencies 中
 * 使用 file: 协议，兼容 npm 和 pnpm
 * @param cwd 工作目录，默认为 process.cwd()
 * @returns 是否成功添加（如果已存在则返回 false）
 */
export function addSpaceflowToDevDependencies(cwd?: string): boolean {
  const { readFileSync, writeFileSync } = require("fs");
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
