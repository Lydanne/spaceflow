import { readFileSync, existsSync, writeFileSync } from "fs";
import { join, dirname, resolve } from "path";
import { homedir } from "os";
import stringify from "json-stringify-pretty-compact";
import { config as dotenvConfig } from "dotenv";

/** 默认编辑器 */
export const DEFAULT_SUPPORT_EDITOR = "claudeCode";

/** 配置文件名 */
export const CONFIG_FILE_NAME = "spaceflow.json";

/** RC 配置文件名（位于 .spaceflow 同级目录） */
export const RC_FILE_NAME = ".spaceflowrc";

/** .env 文件名 */
const ENV_FILE_NAME = ".env";

// 不应该被深度合并的字段，这些字段应该直接覆盖而非合并
const NO_MERGE_FIELDS = ["dependencies"];

/**
 * 深度合并对象
 * 后面的对象会覆盖前面的对象，数组会被替换而非合并
 * NO_MERGE_FIELDS 中的字段不会被深度合并，而是直接覆盖
 */
export function deepMerge<T extends Record<string, unknown>>(...objects: Partial<T>[]): Partial<T> {
  const result: Record<string, unknown> = {};

  for (const obj of objects) {
    for (const key in obj) {
      const value = obj[key];
      const existing = result[key];

      // 对于 NO_MERGE_FIELDS 中的字段，直接覆盖而非合并
      if (NO_MERGE_FIELDS.includes(key)) {
        if (value !== undefined) {
          result[key] = value;
        }
      } else if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        existing !== null &&
        typeof existing === "object" &&
        !Array.isArray(existing)
      ) {
        result[key] = deepMerge(
          existing as Record<string, unknown>,
          value as Record<string, unknown>,
        );
      } else if (value !== undefined) {
        result[key] = value;
      }
    }
  }

  return result as Partial<T>;
}

/**
 * 获取主配置文件路径（用于写入）
 * 配置文件统一存放在 .spaceflow/ 目录下
 * @param cwd 工作目录，默认为 process.cwd()
 */
export function getConfigPath(cwd?: string): string {
  return join(cwd || process.cwd(), ".spaceflow", CONFIG_FILE_NAME);
}

/**
 * 获取所有配置文件路径（按优先级从低到高排列）
 * 从 cwd 逐级向上遍历查找 .spaceflowrc 和 .spaceflow/spaceflow.json，
 * 越靠近 cwd 的优先级越高。全局配置优先级最低。
 *
 * 优先级示例（从低到高）:
 *   ~/.spaceflow/spaceflow.json < ~/.spaceflowrc
 *   < /project/.spaceflow/spaceflow.json < /project/.spaceflowrc
 *   < /project/extensions/publish/.spaceflow/spaceflow.json < /project/extensions/publish/.spaceflowrc
 *
 * @param cwd 工作目录，默认为 process.cwd()
 */
export function getConfigPaths(cwd?: string, options?: { local?: boolean }): string[] {
  const workDir = resolve(cwd || process.cwd());
  const home = homedir();

  // local 模式：只读当前目录和全局目录，不向上遍历
  if (options?.local) {
    return [
      join(home, ".spaceflow", CONFIG_FILE_NAME),
      join(home, RC_FILE_NAME),
      join(workDir, ".spaceflow", CONFIG_FILE_NAME),
      join(workDir, RC_FILE_NAME),
    ];
  }

  // 从 cwd 向上收集所有祖先目录（不含 home，home 单独处理）
  const ancestors: string[] = [];
  let current = workDir;
  while (true) {
    ancestors.push(current);
    const parent = dirname(current);
    if (parent === current) break; // 到达文件系统根
    current = parent;
  }

  // 全局配置（最低优先级）
  const paths: string[] = [join(home, ".spaceflow", CONFIG_FILE_NAME), join(home, RC_FILE_NAME)];

  // 从最远祖先到 cwd（优先级递增）
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const dir = ancestors[i];
    // 跳过 home 目录（已在全局配置中处理）
    if (dir === home) continue;
    paths.push(join(dir, ".spaceflow", CONFIG_FILE_NAME));
    paths.push(join(dir, RC_FILE_NAME));
  }

  return paths;
}

/**
 * 获取所有 .env 文件路径（按优先级从高到低排列）
 * 从 cwd 逐级向上遍历查找 .env 和 .spaceflow/.env，
 * 越靠近 cwd 的优先级越高（先加载的变量不会被后加载的覆盖）。
 *
 * @param cwd 工作目录，默认为 process.cwd()
 */
export function getEnvFilePaths(cwd?: string): string[] {
  const workDir = resolve(cwd || process.cwd());
  const home = homedir();

  // 从 cwd 向上收集所有祖先目录
  const ancestors: string[] = [];
  let current = workDir;
  while (true) {
    ancestors.push(current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  // 从 cwd 到最远祖先（优先级递减）
  const paths: string[] = [];
  for (const dir of ancestors) {
    if (dir === home) continue;
    paths.push(join(dir, ENV_FILE_NAME));
    paths.push(join(dir, ".spaceflow", ENV_FILE_NAME));
  }

  // 全局配置（最低优先级）
  paths.push(join(home, ENV_FILE_NAME));
  paths.push(join(home, ".spaceflow", ENV_FILE_NAME));

  return paths;
}

/**
 * 加载 .env 文件到 process.env
 * 按优先级从高到低加载，先加载的变量不会被后加载的覆盖
 * @param paths .env 文件路径列表（按优先级从高到低排列）
 */
export function loadEnvFiles(paths: string[]): void {
  for (const envPath of paths) {
    if (existsSync(envPath)) {
      dotenvConfig({ path: envPath, override: false });
    }
  }
}

/**
 * 读取单个配置文件（同步）
 * @param configPath 配置文件路径
 */
function readSingleConfigSync(configPath: string): Record<string, unknown> {
  if (!existsSync(configPath)) {
    return {};
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    return JSON.parse(content);
  } catch {
    console.warn(`警告: 无法解析配置文件 ${configPath}`);
    return {};
  }
}

/**
 * 读取配置文件（同步）
 * 按优先级从低到高读取并合并配置：
 * 1. ~/.spaceflow/spaceflow.json (全局配置，最低优先级)
 * 2. ~/.spaceflowrc (全局 RC 配置)
 * 3. ./.spaceflow/spaceflow.json (项目配置)
 * 4. ./.spaceflowrc (项目根目录 RC 配置，最高优先级)
 * @param cwd 工作目录，默认为 process.cwd()
 */
export function readConfigSync(
  cwd?: string,
  options?: { local?: boolean },
): Record<string, unknown> {
  const configPaths = getConfigPaths(cwd, options);
  const configs = configPaths.map((p) => readSingleConfigSync(p));
  return deepMerge(...configs);
}

/**
 * 写入配置文件（同步）
 * @param config 配置对象
 * @param cwd 工作目录，默认为 process.cwd()
 */
export function writeConfigSync(config: Record<string, unknown>, cwd?: string): void {
  const configPath = getConfigPath(cwd);
  writeFileSync(configPath, stringify(config, { indent: 2 }) + "\n");
}

/**
 * 获取支持的编辑器列表
 * @param cwd 工作目录，默认为 process.cwd()
 */
export function getSupportedEditors(cwd?: string): string[] {
  const config = readConfigSync(cwd);
  return (config.support as string[]) || [DEFAULT_SUPPORT_EDITOR];
}

/**
 * 获取 dependencies
 * @param cwd 工作目录，默认为 process.cwd()
 */
export function getDependencies(
  cwd?: string,
  options?: { local?: boolean },
): Record<string, string> {
  const config = readConfigSync(cwd, options);
  return (config.dependencies as Record<string, string>) || {};
}

/**
 * 找到包含指定字段的最高优先级配置文件路径
 * 如果没有找到，返回项目级 .spaceflowrc 路径（默认写入位置）
 * @param field 要查找的字段名
 * @param cwd 工作目录
 */
export function findConfigFileWithField(field: string, cwd?: string): string {
  const workDir = cwd || process.cwd();
  // 按优先级从高到低查找，找到第一个包含该字段的文件
  const candidates = [
    join(workDir, RC_FILE_NAME),
    join(workDir, ".spaceflow", CONFIG_FILE_NAME),
    join(homedir(), RC_FILE_NAME),
    join(homedir(), ".spaceflow", CONFIG_FILE_NAME),
  ];

  for (const filePath of candidates) {
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, "utf-8");
        const config = JSON.parse(content);
        if (config[field] !== undefined) {
          return filePath;
        }
      } catch {
        // 解析失败，跳过
      }
    }
  }

  // 默认写入项目级 .spaceflowrc
  return join(workDir, RC_FILE_NAME);
}

/**
 * 更新单个 dependency
 * 找到 dependencies 所在的配置文件并原地更新，默认写入 .spaceflowrc
 * @param name 依赖名称
 * @param source 依赖来源
 * @param cwd 工作目录，默认为 process.cwd()
 * @returns 是否有更新（false 表示已存在相同配置）
 */
export function updateDependency(name: string, source: string, cwd?: string): boolean {
  const targetFile = findConfigFileWithField("dependencies", cwd);
  const config = existsSync(targetFile)
    ? (JSON.parse(readFileSync(targetFile, "utf-8")) as Record<string, unknown>)
    : ({} as Record<string, unknown>);

  if (!config.dependencies) {
    config.dependencies = {};
  }

  const dependencies = config.dependencies as Record<string, string>;

  // 检查是否已存在相同配置
  if (dependencies[name] === source) {
    return false;
  }

  dependencies[name] = source;
  writeFileSync(targetFile, stringify(config, { indent: 2 }) + "\n");
  return true;
}

/**
 * 删除单个 dependency
 * 找到 dependencies 所在的配置文件并原地更新
 * @param name 依赖名称
 * @param cwd 工作目录，默认为 process.cwd()
 * @returns 是否有删除（false 表示不存在）
 */
export function removeDependency(name: string, cwd?: string): boolean {
  const targetFile = findConfigFileWithField("dependencies", cwd);
  if (!existsSync(targetFile)) {
    return false;
  }

  let config: Record<string, unknown>;
  try {
    config = JSON.parse(readFileSync(targetFile, "utf-8"));
  } catch {
    return false;
  }

  if (!config.dependencies) {
    return false;
  }

  const dependencies = config.dependencies as Record<string, string>;

  if (!(name in dependencies)) {
    return false;
  }

  delete dependencies[name];
  writeFileSync(targetFile, stringify(config, { indent: 2 }) + "\n");
  return true;
}
