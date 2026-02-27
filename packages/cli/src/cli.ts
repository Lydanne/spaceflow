#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname, resolve } from "path";
import { execSync } from "child_process";
import { homedir } from "os";
import {
  SPACEFLOW_DIR,
  ensureSpaceflowPackageJson,
  ensureDependencies,
  getDependencies,
  loadEnvFiles,
  getEnvFilePaths,
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
 * 获取 .spaceflow 目录路径
 * 从 cwd 向上遍历查找已存在的 .spaceflow 目录，
 * 如果整个目录树中都没有，则回退到 cwd/.spaceflow
 */
function getSpaceflowDir(): string {
  let current = resolve(process.cwd());
  const home = homedir();

  while (true) {
    const candidate = join(current, SPACEFLOW_DIR);
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) break; // 文件系统根
    current = parent;
  }

  // 没有找到任何工作区级 .spaceflow，回退到全局目录 ~/.spaceflow
  return join(home, SPACEFLOW_DIR);
}

/**
 * 从 spaceflow.json / .spaceflowrc 读取外部扩展包名列表
 */
function readExternalExtensions(): string[] {
  const deps = getDependencies(undefined, { local: true });
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

async function bootstrap() {
  // 初始化 i18n，再加载扩展（扩展 import 时会调用 t() 获取翻译）
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

// 0. 先加载 .env 文件，确保 process.env 在子进程（含 schema 模块求值）前已就绪
loadEnvFiles(getEnvFilePaths());

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
