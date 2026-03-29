import { access, copyFile, mkdir, readdir } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

interface SyncRuntimeTeaxDefaultsResult {
  sourceDir: string;
  targetDir: string;
  missingSource: boolean;
  copiedFiles: string[];
}

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
  const rawRoot = String(config.agentRuntimeRoot || ".teax-agent-runtime");
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
    syncOncePromise = syncRuntimeTeaxDefaultsImpl();
  }
  return syncOncePromise;
}
