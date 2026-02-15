import type { GitDiffFile } from "./git-sdk.types";

const GIT_STATUS_MAP: Record<string, string> = {
  A: "added",
  M: "modified",
  D: "deleted",
  R: "renamed",
  C: "copied",
};

export function mapGitStatus(status: string): string {
  return GIT_STATUS_MAP[status] || "modified";
}

export function parseChangedLinesFromPatch(patch?: string): Set<number> {
  const changedLines = new Set<number>();
  if (!patch) return changedLines;

  const lines = patch.split("\n");
  let currentLine = 0;

  for (const line of lines) {
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      currentLine = parseInt(hunkMatch[1], 10);
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      changedLines.add(currentLine);
      currentLine++;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      // 删除行，不增加 currentLine
    } else if (!line.startsWith("\\")) {
      currentLine++;
    }
  }

  return changedLines;
}

/**
 * 表示一个 diff hunk 的行号变更信息
 */
export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
}

/**
 * 从 patch 中解析所有 hunk 信息
 */
export function parseHunksFromPatch(patch?: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  if (!patch) return hunks;

  const lines = patch.split("\n");
  for (const line of lines) {
    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch) {
      hunks.push({
        oldStart: parseInt(hunkMatch[1], 10),
        oldCount: parseInt(hunkMatch[2] ?? "1", 10),
        newStart: parseInt(hunkMatch[3], 10),
        newCount: parseInt(hunkMatch[4] ?? "1", 10),
      });
    }
  }
  return hunks;
}

/**
 * 根据 diff hunks 计算旧行号对应的新行号
 * @param oldLine 旧文件中的行号
 * @param hunks diff hunk 列表
 * @returns 新行号，如果该行被删除则返回 null
 */
export function calculateNewLineNumber(oldLine: number, hunks: DiffHunk[]): number | null {
  let offset = 0;

  for (const hunk of hunks) {
    const oldEnd = hunk.oldStart + hunk.oldCount - 1;

    if (oldLine < hunk.oldStart) {
      // 行号在这个 hunk 之前，应用之前累积的偏移
      break;
    }

    if (oldLine >= hunk.oldStart && oldLine <= oldEnd) {
      // 行号在这个 hunk 的删除范围内
      // 需要检查这一行是否被删除
      // 简化处理：如果 hunk 有删除（oldCount > 0），且行在范围内，认为可能被修改
      // 返回对应的新位置（基于 hunk 的起始位置）
      const lineOffsetInHunk = oldLine - hunk.oldStart;
      if (lineOffsetInHunk < hunk.newCount) {
        // 行仍然存在（可能被修改）
        return hunk.newStart + lineOffsetInHunk + offset;
      } else {
        // 行被删除
        return null;
      }
    }

    // 计算这个 hunk 带来的偏移
    offset += hunk.newCount - hunk.oldCount;
  }

  // 行号在所有 hunk 之后，应用总偏移
  return oldLine + offset;
}

/**
 * 批量计算文件中多个旧行号对应的新行号
 * @param oldLines 旧行号数组
 * @param patch diff patch 文本
 * @returns Map<旧行号, 新行号>，被删除的行不在结果中
 */
export function calculateLineOffsets(
  oldLines: number[],
  patch?: string,
): Map<number, number | null> {
  const result = new Map<number, number | null>();
  const hunks = parseHunksFromPatch(patch);

  for (const oldLine of oldLines) {
    result.set(oldLine, calculateNewLineNumber(oldLine, hunks));
  }

  return result;
}

export function parseDiffText(diffText: string): GitDiffFile[] {
  const files: GitDiffFile[] = [];
  const fileDiffs = diffText.split(/^diff --git /m).filter(Boolean);

  for (const fileDiff of fileDiffs) {
    const headerMatch = fileDiff.match(/^a\/(.+?) b\/(.+?)[\r\n]/);
    if (!headerMatch) continue;

    const filename = headerMatch[2];
    const patchStart = fileDiff.indexOf("@@");
    if (patchStart === -1) continue;

    const patch = fileDiff.slice(patchStart);
    files.push({ filename, patch });
  }

  return files;
}
