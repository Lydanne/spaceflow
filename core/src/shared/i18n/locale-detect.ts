import { readFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";
import { homedir, platform } from "os";

/** 默认语言 */
const DEFAULT_LOCALE = "zh-CN";

/** 配置文件名 */
const CONFIG_FILE_NAME = "spaceflow.json";

/** .spaceflow 目录名 */
const SPACEFLOW_DIR = ".spaceflow";

/**
 * 标准化 locale 字符串为 BCP 47 格式
 * @example "zh_CN" → "zh-CN", "zh-Hans" → "zh-CN", "en_US.UTF-8" → "en-US"
 */
function normalizeLocale(raw: string): string | undefined {
  const cleaned = raw.replace(/\..*$/, "").trim();
  // 处理 Apple 格式：zh-Hans → zh-CN, zh-Hant → zh-TW
  if (/^zh[-_]?Hans/i.test(cleaned)) return "zh-CN";
  if (/^zh[-_]?Hant/i.test(cleaned)) return "zh-TW";
  // 处理标准格式：zh_CN / zh-CN / en_US / en-US
  const match = cleaned.match(/^([a-z]{2})[-_]([A-Z]{2})/i);
  if (match) return `${match[1].toLowerCase()}-${match[2].toUpperCase()}`;
  // 处理纯语言代码：zh → zh-CN, en → en
  const langOnly = cleaned.match(/^([a-z]{2})$/i);
  if (langOnly) {
    const lang = langOnly[1].toLowerCase();
    return lang === "zh" ? "zh-CN" : lang;
  }
  return undefined;
}

/**
 * 从 spaceflow.json 读取 lang 字段
 * 按优先级从高到低查找：项目 > 全局
 */
function readLangFromConfig(): string | undefined {
  const paths = [
    join(process.cwd(), SPACEFLOW_DIR, CONFIG_FILE_NAME),
    join(homedir(), SPACEFLOW_DIR, CONFIG_FILE_NAME),
  ];
  for (const configPath of paths) {
    if (!existsSync(configPath)) continue;
    try {
      const content = readFileSync(configPath, "utf-8");
      const config = JSON.parse(content) as Record<string, unknown>;
      if (typeof config.lang === "string" && config.lang.length > 0) {
        return normalizeLocale(config.lang) ?? config.lang;
      }
    } catch {
      // 忽略解析错误
    }
  }
  return undefined;
}

/**
 * 从系统环境变量推断 locale
 * 解析 LANG 格式如 "zh_CN.UTF-8" → "zh-CN"
 */
function readEnvLocale(): string | undefined {
  const raw = process.env.LC_ALL || process.env.LANG;
  if (!raw) return undefined;
  return normalizeLocale(raw);
}

/**
 * macOS：通过 defaults read 获取系统首选语言
 * AppleLanguages 比 LANG 环境变量更准确地反映用户实际语言偏好
 */
function readMacOSLocale(): string | undefined {
  try {
    const output = execSync("defaults read -g AppleLanguages", {
      encoding: "utf-8",
      timeout: 500,
      stdio: ["pipe", "pipe", "pipe"],
    });
    // 输出格式: (\n    "zh-Hans-CN",\n    "en-CN"\n)
    const match = output.match(/"([^"]+)"/);
    if (!match) return undefined;
    return normalizeLocale(match[1]);
  } catch {
    return undefined;
  }
}

/**
 * Windows：通过 PowerShell 获取系统 UI 语言
 */
function readWindowsLocale(): string | undefined {
  try {
    const output = execSync('powershell -NoProfile -Command "(Get-Culture).Name"', {
      encoding: "utf-8",
      timeout: 1000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const trimmed = output.trim();
    if (!trimmed) return undefined;
    return normalizeLocale(trimmed);
  } catch {
    return undefined;
  }
}

/**
 * 读取操作系统级别的语言偏好
 * macOS: defaults read -g AppleLanguages
 * Windows: PowerShell Get-Culture
 */
function readOSLocale(): string | undefined {
  const os = platform();
  if (os === "darwin") return readMacOSLocale();
  if (os === "win32") return readWindowsLocale();
  return undefined;
}

/**
 * 检测当前语言
 *
 * 优先级：
 * 1. 环境变量 SPACEFLOW_LANG
 * 2. spaceflow.json 中的 lang 字段（项目 > 全局）
 * 3. 操作系统语言偏好（macOS AppleLanguages / Windows Get-Culture）
 * 4. 系统环境变量 LC_ALL / LANG
 * 5. 回退到 zh-CN
 */
export function detectLocale(): string {
  const envLang = process.env.SPACEFLOW_LANG;
  if (envLang) return normalizeLocale(envLang) ?? envLang;
  return readLangFromConfig() || readOSLocale() || readEnvLocale() || DEFAULT_LOCALE;
}
