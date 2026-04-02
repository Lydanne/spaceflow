import { access, copyFile, mkdir, readdir } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

interface SyncRuntimeTeaxDefaultsResult {
  sourceDir: string;
  targetDir: string;
  missingSource: boolean;
  copiedFiles: string[];
}

// 启动期只需要同步一次默认文件，避免高并发请求重复扫描和复制文件。
let syncOncePromise: Promise<SyncRuntimeTeaxDefaultsResult> | null = null;

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveRuntimeTeaxTargetDir(): string {
  const config = useRuntimeConfig();
  // runtime root 支持相对路径（相对项目根）与绝对路径两种配置方式。
  const rawRoot = String(config.agent.runtimeRoot || ".teax-agent-runtime");
  const runtimeRoot = isAbsolute(rawRoot) ? rawRoot : resolve(process.cwd(), rawRoot);
  return join(runtimeRoot, ".teax");
}

function resolveRuntimeTeaxDefaultsSourceDir(): string {
  return resolve(process.cwd(), "defaults", ".teax");
}

async function listFilesRecursively(rootDir: string): Promise<string[]> {
  const files: string[] = [];

  const visit = async (currentDir: string, relativeDir: string) => {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const nextRelative = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      const nextPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        // 目录继续深度遍历，最终返回的是相对 rootDir 的文件路径列表。
        await visit(nextPath, nextRelative);
      } else if (entry.isFile()) {
        files.push(nextRelative);
      }
    }
  };

  await visit(rootDir, "");
  return files;
}

async function syncRuntimeTeaxDefaultsImpl(): Promise<SyncRuntimeTeaxDefaultsResult> {
  const sourceDir = resolveRuntimeTeaxDefaultsSourceDir();
  const targetDir = resolveRuntimeTeaxTargetDir();
  const copiedFiles: string[] = [];

  if (!await pathExists(sourceDir)) {
    // 允许 defaults 目录缺失：在最小部署场景下不阻断主流程，交由调用方决定后续策略。
    return {
      sourceDir,
      targetDir,
      missingSource: true,
      copiedFiles,
    };
  }

  const relativeFiles = await listFilesRecursively(sourceDir);
  for (const relativePath of relativeFiles) {
    const sourcePath = join(sourceDir, relativePath);
    const targetPath = join(targetDir, relativePath);
    if (await pathExists(targetPath)) {
      // 仅补齐缺失文件，不覆盖已存在配置，避免用户自定义内容被重置。
      continue;
    }
    await mkdir(dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath);
    copiedFiles.push(relativePath);
  }

  return {
    sourceDir,
    targetDir,
    missingSource: false,
    copiedFiles,
  };
}

export async function syncRuntimeTeaxDefaults() {
  return syncRuntimeTeaxDefaultsImpl();
}

export async function ensureRuntimeTeaxDefaultsSynced() {
  if (!syncOncePromise) {
    // 通过缓存 Promise 实现“并发去重”：同一时刻多个调用共享一次同步任务。
    syncOncePromise = syncRuntimeTeaxDefaultsImpl();
  }
  return syncOncePromise;
}
