import {
  mapGitStatus,
  parseChangedLinesFromPatch,
  parseHunksFromPatch,
  calculateNewLineNumber,
  calculateLineOffsets,
  parseDiffText,
} from "./git-sdk-diff.utils";

describe("git-sdk-diff.utils", () => {
  describe("parseHunksFromPatch", () => {
    it("should parse single hunk", () => {
      const patch = `@@ -1,3 +1,4 @@
 line1
+new line
 line2
 line3`;
      const hunks = parseHunksFromPatch(patch);
      expect(hunks).toHaveLength(1);
      expect(hunks[0]).toEqual({
        oldStart: 1,
        oldCount: 3,
        newStart: 1,
        newCount: 4,
      });
    });

    it("should parse multiple hunks", () => {
      const patch = `@@ -1,3 +1,4 @@
 line1
+new line
 line2
 line3
@@ -10,2 +11,3 @@
 line10
+another new line
 line11`;
      const hunks = parseHunksFromPatch(patch);
      expect(hunks).toHaveLength(2);
      expect(hunks[0]).toEqual({
        oldStart: 1,
        oldCount: 3,
        newStart: 1,
        newCount: 4,
      });
      expect(hunks[1]).toEqual({
        oldStart: 10,
        oldCount: 2,
        newStart: 11,
        newCount: 3,
      });
    });

    it("should handle single line hunk without count", () => {
      const patch = `@@ -5 +5,2 @@
 line5
+new line`;
      const hunks = parseHunksFromPatch(patch);
      expect(hunks).toHaveLength(1);
      expect(hunks[0]).toEqual({
        oldStart: 5,
        oldCount: 1,
        newStart: 5,
        newCount: 2,
      });
    });

    it("should return empty array for undefined patch", () => {
      expect(parseHunksFromPatch(undefined)).toEqual([]);
    });
  });

  describe("calculateNewLineNumber", () => {
    it("should return same line number when no hunks", () => {
      expect(calculateNewLineNumber(5, [])).toBe(5);
    });

    it("should offset line number after insertion", () => {
      // 在第1行后插入1行，原来的第5行变成第6行
      const hunks = [{ oldStart: 1, oldCount: 1, newStart: 1, newCount: 2 }];
      expect(calculateNewLineNumber(5, hunks)).toBe(6);
    });

    it("should offset line number after multiple insertions", () => {
      // 在第1行插入2行，原来的第5行变成第7行
      const hunks = [{ oldStart: 1, oldCount: 1, newStart: 1, newCount: 3 }];
      expect(calculateNewLineNumber(5, hunks)).toBe(7);
    });

    it("should offset line number after deletion", () => {
      // 删除第1-2行，原来的第5行变成第3行
      const hunks = [{ oldStart: 1, oldCount: 2, newStart: 1, newCount: 0 }];
      expect(calculateNewLineNumber(5, hunks)).toBe(3);
    });

    it("should return null when line is deleted", () => {
      // 删除第5行
      const hunks = [{ oldStart: 5, oldCount: 1, newStart: 5, newCount: 0 }];
      expect(calculateNewLineNumber(5, hunks)).toBeNull();
    });

    it("should handle line before any hunk", () => {
      // 第10行有变更，第5行不受影响
      const hunks = [{ oldStart: 10, oldCount: 1, newStart: 10, newCount: 2 }];
      expect(calculateNewLineNumber(5, hunks)).toBe(5);
    });

    it("should handle multiple hunks with cumulative offset", () => {
      // 第1行插入1行，第10行插入1行
      // 原来的第15行：经过第一个hunk偏移+1，经过第二个hunk偏移+1，变成17行
      const hunks = [
        { oldStart: 1, oldCount: 1, newStart: 1, newCount: 2 },
        { oldStart: 10, oldCount: 1, newStart: 11, newCount: 2 },
      ];
      expect(calculateNewLineNumber(15, hunks)).toBe(17);
    });

    it("should handle line within modified hunk", () => {
      // 第5-7行被修改为5-8行（3行变4行）
      const hunks = [{ oldStart: 5, oldCount: 3, newStart: 5, newCount: 4 }];
      expect(calculateNewLineNumber(5, hunks)).toBe(5);
      expect(calculateNewLineNumber(6, hunks)).toBe(6);
      expect(calculateNewLineNumber(7, hunks)).toBe(7);
      // 第8行在hunk之后，偏移+1
      expect(calculateNewLineNumber(8, hunks)).toBe(9);
    });
  });

  describe("calculateLineOffsets", () => {
    it("should calculate offsets for multiple lines", () => {
      // 在第1行后插入2行：原1-3行变成1-5行
      // 原第1行 -> 新第1行（在hunk内，位置0）
      // 原第2行 -> 新第2行（在hunk内，位置1）
      // 原第3行 -> 新第3行（在hunk内，位置2）
      // 原第5行 -> 新第7行（在hunk后，偏移+2）
      // 原第10行 -> 新第12行（在hunk后，偏移+2）
      const patch = `@@ -1,3 +1,5 @@
 line1
+new line 1
+new line 2
 line2
 line3`;
      const result = calculateLineOffsets([1, 2, 3, 5, 10], patch);
      expect(result.get(1)).toBe(1);
      expect(result.get(2)).toBe(2); // 原第2行在hunk内，位置1
      expect(result.get(3)).toBe(3); // 原第3行在hunk内，位置2
      expect(result.get(5)).toBe(7); // 原第5行在hunk后，偏移+2
      expect(result.get(10)).toBe(12); // 原第10行在hunk后，偏移+2
    });

    it("should mark deleted lines as null", () => {
      const patch = `@@ -5,2 +5,0 @@
-deleted line 1
-deleted line 2`;
      const result = calculateLineOffsets([4, 5, 6, 7], patch);
      expect(result.get(4)).toBe(4); // 不受影响
      expect(result.get(5)).toBeNull(); // 被删除
      expect(result.get(6)).toBeNull(); // 被删除
      expect(result.get(7)).toBe(5); // 偏移-2
    });
  });

  describe("issue line number update scenarios", () => {
    // 模拟 ReviewService.updateIssueLineNumbers 的核心逻辑
    function updateIssueLine(
      oldLine: string,
      patch: string,
    ): { newLine: string | null; deleted: boolean } {
      const lineMatch = oldLine.match(/^(\d+)(?:-(\d+))?$/);
      if (!lineMatch) return { newLine: oldLine, deleted: false };

      const startLine = parseInt(lineMatch[1], 10);
      const endLine = lineMatch[2] ? parseInt(lineMatch[2], 10) : startLine;
      const hunks = parseHunksFromPatch(patch);

      const newStartLine = calculateNewLineNumber(startLine, hunks);
      if (newStartLine === null) {
        return { newLine: null, deleted: true };
      }

      if (startLine === endLine) {
        return { newLine: String(newStartLine), deleted: false };
      }

      const newEndLine = calculateNewLineNumber(endLine, hunks);
      if (newEndLine === null) {
        return { newLine: String(newStartLine), deleted: false };
      }
      return { newLine: `${newStartLine}-${newEndLine}`, deleted: false };
    }

    it("should update line when code is inserted before issue", () => {
      // 在第1行插入2行，原第5行变成第7行
      const patch = `@@ -1,3 +1,5 @@
 line1
+new line 1
+new line 2
 line2
 line3`;
      const result = updateIssueLine("5", patch);
      expect(result.newLine).toBe("7");
      expect(result.deleted).toBe(false);
    });

    it("should update line when code is deleted before issue", () => {
      // 删除第1-2行，原第5行变成第3行
      const patch = `@@ -1,4 +1,2 @@
-line1
-line2
 line3
 line4`;
      const result = updateIssueLine("5", patch);
      expect(result.newLine).toBe("3");
      expect(result.deleted).toBe(false);
    });

    it("should mark as deleted when issue line is removed", () => {
      // 删除第5行
      const patch = `@@ -5,1 +5,0 @@
-deleted line`;
      const result = updateIssueLine("5", patch);
      expect(result.deleted).toBe(true);
    });

    it("should handle range line numbers", () => {
      // 在第1行插入2行，原第5-7行变成第7-9行
      const patch = `@@ -1,3 +1,5 @@
 line1
+new line 1
+new line 2
 line2
 line3`;
      const result = updateIssueLine("5-7", patch);
      expect(result.newLine).toBe("7-9");
      expect(result.deleted).toBe(false);
    });

    it("should handle range when end line is deleted", () => {
      // 删除第7行，原第5-7行变成第5行
      const patch = `@@ -7,1 +7,0 @@
-deleted line`;
      const result = updateIssueLine("5-7", patch);
      expect(result.newLine).toBe("5");
      expect(result.deleted).toBe(false);
    });

    it("should not change line when no relevant changes", () => {
      // 在第10行插入，原第5行不变
      const patch = `@@ -10,1 +10,2 @@
 line10
+new line`;
      const result = updateIssueLine("5", patch);
      expect(result.newLine).toBe("5");
      expect(result.deleted).toBe(false);
    });
  });

  describe("mapGitStatus", () => {
    it("should map known statuses", () => {
      expect(mapGitStatus("A")).toBe("added");
      expect(mapGitStatus("M")).toBe("modified");
      expect(mapGitStatus("D")).toBe("deleted");
      expect(mapGitStatus("R")).toBe("renamed");
      expect(mapGitStatus("C")).toBe("copied");
    });

    it("should default to modified for unknown status", () => {
      expect(mapGitStatus("X")).toBe("modified");
      expect(mapGitStatus("")).toBe("modified");
    });
  });

  describe("parseChangedLinesFromPatch", () => {
    it("should return empty set for undefined patch", () => {
      expect(parseChangedLinesFromPatch(undefined)).toEqual(new Set());
    });

    it("should parse added lines", () => {
      const patch = `@@ -1,3 +1,5 @@
 line1
+added1
+added2
 line2
 line3`;
      const result = parseChangedLinesFromPatch(patch);
      expect(result).toEqual(new Set([2, 3]));
    });

    it("should skip deleted lines", () => {
      const patch = `@@ -1,3 +1,1 @@
-deleted1
-deleted2
 line3`;
      const result = parseChangedLinesFromPatch(patch);
      expect(result.size).toBe(0);
    });

    it("should handle mixed additions and deletions", () => {
      const patch = `@@ -1,4 +1,4 @@
 line1
-old line
+new line
 line3
 line4`;
      const result = parseChangedLinesFromPatch(patch);
      expect(result).toEqual(new Set([2]));
    });
  });

  describe("parseDiffText", () => {
    it("should parse diff text into files", () => {
      const diffText = `diff --git a/file1.ts b/file1.ts
--- a/file1.ts
+++ b/file1.ts
@@ -1,3 +1,4 @@
 line1
+new line
 line2
 line3
diff --git a/file2.ts b/file2.ts
--- a/file2.ts
+++ b/file2.ts
@@ -1,2 +1,1 @@
-old
 kept`;
      const files = parseDiffText(diffText);
      expect(files).toHaveLength(2);
      expect(files[0].filename).toBe("file1.ts");
      expect(files[0].patch).toContain("@@ -1,3 +1,4 @@");
      expect(files[1].filename).toBe("file2.ts");
    });

    it("should skip files without patch", () => {
      const diffText = `diff --git a/binary.png b/binary.png
Binary files differ`;
      const files = parseDiffText(diffText);
      expect(files).toHaveLength(0);
    });

    it("should return empty array for empty input", () => {
      expect(parseDiffText("")).toEqual([]);
    });
  });
});
