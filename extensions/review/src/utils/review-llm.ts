import type { PullRequestCommit } from "@spaceflow/core";
import type { CodeBlockType } from "../review-includes-filter";

/**
 * 构建带行号的文件内容字符串。
 *
 * @param contentLines  [hash, code] 行数组
 * @param visibleRanges 可选，指定需要输出的行号区间 [startLine, endLine]（不含则输出全文）
 *                      被跳过的连续行用 `...... ..| ignore {start}-{end} code` 占位
 */
export function buildLinesWithNumbers(
  contentLines: [string, string][],
  visibleRanges?: [number, number][],
): string {
  const padWidth = String(contentLines.length).length;

  if (!visibleRanges || visibleRanges.length === 0) {
    return contentLines
      .map(([hash, line], index) => {
        const lineNum = index + 1;
        return `${hash} ${String(lineNum).padStart(padWidth)}| ${line}`;
      })
      .join("\n");
  }

  // 将 ranges 按起始行号排序并合并重叠区间
  const sorted = [...visibleRanges].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of sorted) {
    if (merged.length > 0 && range[0] <= merged[merged.length - 1][1] + 1) {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], range[1]);
    } else {
      merged.push([...range]);
    }
  }

  const output: string[] = [];
  let prevEnd = 0;

  for (const [start, end] of merged) {
    const clampedStart = Math.max(1, start);
    const clampedEnd = Math.min(contentLines.length, end);

    // 被忽略的前缀区间
    if (clampedStart > prevEnd + 1) {
      output.push(`....... ignore ${prevEnd + 1}-${clampedStart - 1} line .......`);
    }

    // 输出可见行
    for (let i = clampedStart - 1; i < clampedEnd; i++) {
      const [hash, line] = contentLines[i];
      const lineNum = i + 1;
      output.push(`${hash} ${String(lineNum).padStart(padWidth)}| ${line}`);
    }

    prevEnd = clampedEnd;
  }

  // 被忽略的末尾区间
  if (prevEnd < contentLines.length) {
    output.push(`....... ignore ${prevEnd + 1}-${contentLines.length} line .......`);
  }

  return output.join("\n");
}

/**
 * 从 contentLines 中提取新增代码里的指定结构类型的行号范围。
 *
 * 逻辑：
 * 1. 只考虑 hash !== "-------" 的新增行
 * 2. 用各类型的正则匹配结构开头行，再用层级计数找到结尾行
 * 3. 返回行号范围列表 [startLine, endLine]（从 1 计）
 *
 * @param contentLines  文件的 [hash, code] 行列表
 * @param types         要提取的结构类型
 */
export function extractCodeBlocks(
  contentLines: [string, string][],
  types: CodeBlockType[],
): [number, number][] {
  if (types.length === 0) return [];

  const ranges: [number, number][] = [];

  // 将所有行的实际代码组成文本（用于层级计数）
  const fullLines = contentLines.map(([, code]) => code);

  // 各类型的开头識别正则（匹配行首）
  const PATTERNS: Record<CodeBlockType, RegExp> = {
    function: /^\s*(?:export\s+)?(?:async\s+)?function\s+\w+/,
    class: /^\s*(?:export\s+)?(?:abstract\s+)?class\s+\w+/,
    interface: /^\s*(?:export\s+)?interface\s+\w+/,
    type: /^\s*(?:export\s+)?type\s+\w+\s*[=<]/,
    method:
      /^\s*(?:(?:public|protected|private|static|async|override|readonly|abstract)\s+)*(?!(?:if|for|while|switch|return|const|let|var|throw|new)\b)(\w+)\s*[(<]/,
  };

  for (let i = 0; i < fullLines.length; i++) {
    const lineNum = i + 1;
    const isAdded = contentLines[i][0] !== "-------";
    if (!isAdded) continue;

    for (const type of types) {
      const pattern = PATTERNS[type];
      if (!pattern.test(fullLines[i])) continue;

      // 找到结构开头，用层级计数找封闭括号结尾
      const endLine = findBlockEnd(fullLines, i);
      ranges.push([lineNum, endLine]);
      break; // 同一行只匹配一种类型
    }
  }

  return mergeRanges(ranges);
}

/**
 * 从开始行向下层级计数，找到匹配的封闭括号位置（行号从 1 计）。
 * 如果没有找到匹配括号，返回开始行到文件末尾。
 */
function findBlockEnd(lines: string[], startIndex: number): number {
  let depth = 0;
  let foundOpen = false;

  for (let i = startIndex; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === "{") {
        depth++;
        foundOpen = true;
      } else if (ch === "}") {
        depth--;
        if (foundOpen && depth === 0) {
          return i + 1; // 行号从 1 计
        }
      }
    }
  }

  return lines.length; // 没有找到匹配括号，返回文件末尾
}

function mergeRanges(ranges: [number, number][]): [number, number][] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i][0] <= last[1] + 1) {
      last[1] = Math.max(last[1], sorted[i][1]);
    } else {
      merged.push([...sorted[i]]);
    }
  }
  return merged;
}

export function buildCommitsSection(
  contentLines: [string, string][],
  commits: PullRequestCommit[],
): string {
  const fileCommitHashes = new Set<string>();
  for (const [hash] of contentLines) {
    if (hash !== "-------") {
      fileCommitHashes.add(hash);
    }
  }
  const relatedCommits = commits.filter((c) => {
    const shortHash = c.sha?.slice(0, 7) || "";
    return fileCommitHashes.has(shortHash);
  });
  return relatedCommits.length > 0
    ? relatedCommits
        .map((c) => `- \`${c.sha?.slice(0, 7)}\` ${c.commit?.message?.split("\n")[0]}`)
        .join("\n")
    : "- 无相关 commits";
}
