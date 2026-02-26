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
 *
 * 使用 dynamic import 加载扩展，确保 i18n 在扩展模块执行前已初始化
 * （扩展在 import 阶段就会调用 t() 获取 description，必须先初始化 i18n）
 */
function generateIndexContent(extensions: string[]): string {
  const dynamicImports = extensions
    .map((name) => `    import('${name}').then(m => m.default || m.extension || m),`)
    .join("\n");

  return `import { exec, initCliI18n } from '@spaceflow/core';
import { loadEnvFiles, getEnvFilePaths } from '@spaceflow/shared';

async function bootstrap() {
  // 1. 先加载 .env 文件，确保 process.env 在 schema 求值前已就绪
  loadEnvFiles(getEnvFilePaths());

  // 2. 初始化 i18n，再加载扩展（扩展 import 时会调用 t() 获取翻译）
  initCliI18n();

  const extensions = await Promise.all([
${dynamicImports}
  ]);

  await exec(extensions);
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
