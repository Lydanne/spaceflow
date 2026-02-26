#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { homedir } from "os";
import {
  SPACEFLOW_DIR,
  ensureSpaceflowPackageJson,
  ensureDependencies,
  getDependencies,
} from "@spaceflow/shared";

/**
 * Spaceflow CLI — 壳子入口
 *
 * 职责：
 * 1. 确保 .spaceflow/ 目录、package.json、.gitignore 完整
 * 2. 确保依赖已安装（pnpm install）
 * 3. 读取外部扩展列表
 * 4. 生成 .spaceflow/bin/index.js（静态 import 入口文件）
 * 5. spawn 子进程执行 node .spaceflow/bin/index.js
 */

/**
 * 获取 .spaceflow 目录路径（优先本地，回退全局）
 */
function getSpaceflowDir(): string {
  const localDir = join(process.cwd(), SPACEFLOW_DIR);
  if (existsSync(localDir)) {
    return localDir;
  }
  const globalDir = join(homedir(), SPACEFLOW_DIR);
  if (existsSync(globalDir)) {
    return globalDir;
  }
  return localDir;
}

/**
 * 从 spaceflow.json / .spaceflowrc 读取外部扩展包名列表
 */
function readExternalExtensions(): string[] {
  const deps = getDependencies();
  return Object.keys(deps);
}

/**
 * 生成 .spaceflow/bin/index.js 内容
 */
function generateIndexContent(extensions: string[]): string {
  const imports = extensions.map((name, i) => `import ext${i} from '${name}';`).join("\n");
  const extArray = extensions.length > 0 ? extensions.map((_, i) => `  ext${i},`).join("\n") : "";

  return `import { exec } from '@spaceflow/core';
${imports}

async function bootstrap() {
  await exec([
${extArray}
  ]);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
`;
}

/**
 * 生成 .spaceflow/bin/index.js 文件
 */
function generateBinFile(spaceflowDir: string, extensions: string[]): string {
  const binDir = join(spaceflowDir, "bin");
  const indexPath = join(binDir, "index.js");

  if (!existsSync(binDir)) {
    mkdirSync(binDir, { recursive: true });
  }

  const content = generateIndexContent(extensions);

  // 仅在内容变化时写入
  if (existsSync(indexPath)) {
    const existing = readFileSync(indexPath, "utf-8");
    if (existing === content) {
      return indexPath;
    }
  }

  writeFileSync(indexPath, content, "utf-8");
  return indexPath;
}

/**
 * 执行生成的 index.js
 */
function executeIndexFile(indexPath: string): void {
  try {
    execSync(`node "${indexPath}" ${process.argv.slice(2).join(" ")}`, {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
    });
  } catch (error: any) {
    // execSync 在子进程非零退出时抛出错误
    // 子进程的 stdout/stderr 已通过 stdio: "inherit" 输出
    process.exit(error.status || 1);
  }
}

// ---- 主流程 ----

// 1. 确保 .spaceflow/ 目录结构完整（目录 + package.json + .gitignore）
const spaceflowDir = getSpaceflowDir();
ensureSpaceflowPackageJson(spaceflowDir);

// 2. 确保依赖已安装
ensureDependencies(spaceflowDir);

// 3. 读取外部扩展列表
const extNames = readExternalExtensions();

// 4. 生成 .spaceflow/bin/index.js
const indexPath = generateBinFile(spaceflowDir, extNames);

// 5. 执行生成的入口文件
executeIndexFile(indexPath);
