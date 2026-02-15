import type { LLMMode, VerboseLevel } from "@spaceflow/core";
import type { AnalyzeDeletionsMode } from "./review.config";
import { normalizeVerbose } from "@spaceflow/core";

/**
 * 从 PR 标题中解析的命令参数
 */
export interface TitleOptions {
  llmMode?: LLMMode;
  verbose?: VerboseLevel;
  dryRun?: boolean;
  includes?: string[];
  verifyFixes?: boolean;
  analyzeDeletions?: AnalyzeDeletionsMode;
  deletionOnly?: boolean;
  deletionAnalysisMode?: LLMMode;
}

/**
 * 从 PR 标题中解析命令参数
 *
 * 支持的格式：标题末尾 [/review -l openai -v 2]
 *
 * 支持的参数：
 * - `-l, --llm-mode <mode>`: LLM 模式 (claude-code, openai, gemini)
 * - `-v, --verbose [level]`: 详细输出级别 (1 或 2)
 * - `-d, --dry-run`: 仅打印不执行
 * - `-i, --includes <pattern>`: 文件过滤模式
 * - `--verify-fixes`: 验证历史问题
 * - `--no-verify-fixes`: 禁用历史问题验证
 * - `--analyze-deletions`: 分析删除代码
 * - `--deletion-only`: 仅执行删除代码分析
 * - `--deletion-analysis-mode <mode>`: 删除分析模式
 *
 * @param title PR 标题
 * @returns 解析出的命令参数，如果没有找到命令则返回空对象
 */
export function parseTitleOptions(title: string): TitleOptions {
  const options: TitleOptions = {};

  // 匹配 [/review ...] 或 [/ai-review ...] (保持向后兼容) 格式
  const match = title.match(/\[\/(review|ai-review)\s+([^\]]+)\]/i);
  if (!match) {
    return options;
  }

  const argsString = match[2].trim();
  const args = parseArgs(argsString);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "-l":
      case "--llm-mode": {
        const value = args[++i];
        if (value && isValidLLMMode(value)) {
          options.llmMode = value;
        }
        break;
      }

      case "-v":
      case "--verbose": {
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith("-")) {
          const level = parseInt(nextArg, 10);
          if (level === 1 || level === 2) {
            options.verbose = level;
            i++;
          } else {
            options.verbose = normalizeVerbose(1);
          }
        } else {
          options.verbose = normalizeVerbose(1);
        }
        break;
      }

      case "-d":
      case "--dry-run":
        options.dryRun = true;
        break;

      case "-i":
      case "--includes": {
        const value = args[++i];
        if (value && !value.startsWith("-")) {
          if (!options.includes) {
            options.includes = [];
          }
          options.includes.push(value);
        }
        break;
      }

      case "--verify-fixes":
        options.verifyFixes = true;
        break;

      case "--no-verify-fixes":
        options.verifyFixes = false;
        break;

      case "--analyze-deletions": {
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith("-") && isValidAnalyzeDeletionsMode(nextArg)) {
          options.analyzeDeletions = parseAnalyzeDeletionsValue(nextArg);
          i++;
        } else {
          options.analyzeDeletions = true;
        }
        break;
      }

      case "--deletion-only":
        options.deletionOnly = true;
        break;

      case "--deletion-analysis-mode": {
        const value = args[++i];
        if (value && isValidDeletionAnalysisMode(value)) {
          options.deletionAnalysisMode = value;
        }
        break;
      }
    }
  }

  return options;
}

/**
 * 解析参数字符串为数组
 * 支持引号包裹的参数值
 */
function parseArgs(argsString: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";

  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i];

    if ((char === '"' || char === "'") && !inQuote) {
      inQuote = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuote) {
      inQuote = false;
      quoteChar = "";
    } else if (char === " " && !inQuote) {
      if (current) {
        args.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current) {
    args.push(current);
  }

  return args;
}

function isValidLLMMode(value: string): value is LLMMode {
  return ["claude-code", "openai", "gemini"].includes(value);
}

function isValidDeletionAnalysisMode(value: string): value is LLMMode {
  return ["openai", "claude-code"].includes(value);
}

function isValidAnalyzeDeletionsMode(value: string): boolean {
  return ["true", "false", "ci", "pr", "terminal"].includes(value);
}

function parseAnalyzeDeletionsValue(value: string): AnalyzeDeletionsMode {
  if (value === "true") return true;
  if (value === "false") return false;
  return value as "ci" | "pr" | "terminal";
}
