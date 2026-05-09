import { describe, it, expect } from "vitest";
import {
  parseIncludePattern,
  filterFilesByIncludes,
  extractGlobsFromIncludes,
  extractCodeBlockTypes,
  matchIncludes,
} from "./review-includes-filter";

describe("review-includes-filter", () => {
  describe("parseIncludePattern", () => {
    it("无分隔符时返回原始 glob，status 为 undefined", () => {
      expect(parseIncludePattern("*/**/*.ts")).toEqual({ status: undefined, glob: "*/**/*.ts" });
    });

    it("! 开头的排除模式直接返回，不解析前缀", () => {
      expect(parseIncludePattern("!*/**/*.spec.ts")).toEqual({
        status: undefined,
        glob: "!*/**/*.spec.ts",
      });
    });

    it("added| 前缀解析为 status=added", () => {
      expect(parseIncludePattern("added|*/**/*.ts")).toEqual({
        status: "added",
        glob: "*/**/*.ts",
      });
    });

    it("modified| 前缀解析为 status=modified", () => {
      expect(parseIncludePattern("modified|*/**/*.ts")).toEqual({
        status: "modified",
        glob: "*/**/*.ts",
      });
    });

    it("deleted| 前缀解析为 status=deleted", () => {
      expect(parseIncludePattern("deleted|*/**/*.ts")).toEqual({
        status: "deleted",
        glob: "*/**/*.ts",
      });
    });

    it("glob 部分可以带 ! 前缀（status 内排除语法）", () => {
      expect(parseIncludePattern("added|!*/**/*.spec.ts")).toEqual({
        status: "added",
        glob: "!*/**/*.spec.ts",
      });
    });

    it("无法识别的前缀当作普通 glob 处理（容错）", () => {
      expect(parseIncludePattern("unknown|*/**/*.ts")).toEqual({
        status: undefined,
        glob: "unknown|*/**/*.ts",
      });
    });

    it("extglob 中含 | 不被误识别为前缀分隔符", () => {
      expect(parseIncludePattern("+(*.ts|*.js)")).toEqual({
        status: undefined,
        glob: "+(*.ts|*.js)",
      });
    });

    it("前缀大小写不敏感", () => {
      expect(parseIncludePattern("Added|*/**/*.ts")).toEqual({
        status: "added",
        glob: "*/**/*.ts",
      });
      expect(parseIncludePattern("MODIFIED|*/**/*.ts")).toEqual({
        status: "modified",
        glob: "*/**/*.ts",
      });
    });

    it("平台别名：created 映射为 added", () => {
      expect(parseIncludePattern("created|*/**/*.ts")).toEqual({
        status: "added",
        glob: "*/**/*.ts",
      });
    });

    it("平台别名：removed 映射为 deleted", () => {
      expect(parseIncludePattern("removed|*/**/*.ts")).toEqual({
        status: "deleted",
        glob: "*/**/*.ts",
      });
    });

    it("平台别名：renamed 映射为 modified", () => {
      expect(parseIncludePattern("renamed|*/**/*.ts")).toEqual({
        status: "modified",
        glob: "*/**/*.ts",
      });
    });
  });

  describe("filterFilesByIncludes", () => {
    const files = [
      { filename: "src/foo.ts", status: "added" },
      { filename: "src/foo.spec.ts", status: "added" },
      { filename: "src/bar.ts", status: "modified" },
      { filename: "src/bar.spec.ts", status: "modified" },
      { filename: "src/old.ts", status: "removed" },
      { filename: "src/old.spec.ts", status: "removed" },
    ];
    const glob = "**/*.ts";
    const specGlob = "**/*.spec.ts";

    it("includes 为空时返回全部文件", () => {
      expect(filterFilesByIncludes(files, [])).toEqual(files);
    });

    it("无前缀 glob 不限 status，匹配所有 .ts 文件", () => {
      const result = filterFilesByIncludes(files, [glob]);
      expect(result.map((f) => f.filename)).toEqual([
        "src/foo.ts",
        "src/foo.spec.ts",
        "src/bar.ts",
        "src/bar.spec.ts",
        "src/old.ts",
        "src/old.spec.ts",
      ]);
    });

    it("排除模式过滤掉 spec 文件", () => {
      const result = filterFilesByIncludes(files, [glob, `!${specGlob}`]);
      expect(result.map((f) => f.filename)).toEqual(["src/foo.ts", "src/bar.ts", "src/old.ts"]);
    });

    it("排除目录 glob 时过滤掉目录下文件", () => {
      const directoryFiles = [
        { filename: "public/foo.js", status: "modified" },
        { filename: "public/assets/bar.ts", status: "modified" },
        { filename: "src/foo.js", status: "modified" },
        { filename: "src/bar.ts", status: "modified" },
      ];
      const result = filterFilesByIncludes(directoryFiles, ["**/*.js", "**/*.ts", "!public/**"]);
      expect(result.map((f) => f.filename)).toEqual(["src/foo.js", "src/bar.ts"]);
    });

    it("无路径分隔符 glob 保持 basename 匹配", () => {
      const nestedFiles = [
        { filename: "src/foo.ts", status: "modified" },
        { filename: "foo.ts", status: "modified" },
        { filename: "src/foo.js", status: "modified" },
      ];
      const result = filterFilesByIncludes(nestedFiles, ["*.ts"]);
      expect(result.map((f) => f.filename)).toEqual(["src/foo.ts", "foo.ts"]);
    });

    it("排除模式优先于所有正向匹配", () => {
      const result = filterFilesByIncludes(files, [`added|${glob}`, `!${specGlob}`]);
      expect(result.map((f) => f.filename)).toEqual(["src/foo.ts"]);
    });

    it("added| 前缀只匹配 added 状态文件", () => {
      const result = filterFilesByIncludes(files, [`added|${glob}`]);
      expect(result.map((f) => f.filename)).toEqual(["src/foo.ts", "src/foo.spec.ts"]);
    });

    it("modified| 前缀只匹配 modified 状态文件", () => {
      const result = filterFilesByIncludes(files, [`modified|${glob}`]);
      expect(result.map((f) => f.filename)).toEqual(["src/bar.ts", "src/bar.spec.ts"]);
    });

    it("deleted| 前缀匹配 removed 状态文件（平台别名）", () => {
      const result = filterFilesByIncludes(files, [`deleted|${glob}`]);
      expect(result.map((f) => f.filename)).toEqual(["src/old.ts", "src/old.spec.ts"]);
    });

    it("多个 status 前缀之间是 OR 关系", () => {
      const result = filterFilesByIncludes(files, [`added|${glob}`, `modified|${glob}`]);
      expect(result.map((f) => f.filename)).toEqual([
        "src/foo.ts",
        "src/foo.spec.ts",
        "src/bar.ts",
        "src/bar.spec.ts",
      ]);
    });

    it("status 前缀内排除语法 added|!**/*.spec.ts", () => {
      const result = filterFilesByIncludes(files, [`added|${glob}`, `added|!${specGlob}`]);
      expect(result.map((f) => f.filename)).toEqual(["src/foo.ts"]);
    });

    it("status 内排除只影响对应 status，不影响其他 status 的匹配", () => {
      const result = filterFilesByIncludes(files, [
        `added|${glob}`,
        `added|!${specGlob}`,
        `modified|${glob}`,
      ]);
      expect(result.map((f) => f.filename)).toEqual([
        "src/foo.ts",
        "src/bar.ts",
        "src/bar.spec.ts",
      ]);
    });

    it("无前缀 glob 与 status 前缀混用时任一命中即保留", () => {
      const result = filterFilesByIncludes(files, [glob, "added|**/*.vue"]);
      expect(result.map((f) => f.filename)).toEqual([
        "src/foo.ts",
        "src/foo.spec.ts",
        "src/bar.ts",
        "src/bar.spec.ts",
        "src/old.ts",
        "src/old.spec.ts",
      ]);
    });

    it("status 未知的文件 fallback 为 modified", () => {
      const unknownFiles = [{ filename: "src/foo.ts", status: undefined }];
      const result = filterFilesByIncludes(unknownFiles, [`modified|${glob}`]);
      expect(result.map((f) => f.filename)).toEqual(["src/foo.ts"]);
    });

    it("status 未知的文件不被 added| 匹配", () => {
      const unknownFiles = [{ filename: "src/foo.ts", status: undefined }];
      const result = filterFilesByIncludes(unknownFiles, [`added|${glob}`]);
      expect(result).toEqual([]);
    });

    it("filename 为空的文件被过滤掉", () => {
      const withEmpty = [
        { filename: "", status: "added" },
        { filename: "src/foo.ts", status: "added" },
      ];
      const result = filterFilesByIncludes(withEmpty, [glob]);
      expect(result.map((f) => f.filename)).toEqual(["src/foo.ts"]);
    });

    it("GitHub 平台 status=removed 被 deleted| 前缀匹配", () => {
      const ghFiles = [{ filename: "src/old.ts", status: "removed" }];
      expect(filterFilesByIncludes(ghFiles, [`deleted|${glob}`])).toHaveLength(1);
    });

    it("GitLab 平台 status=deleted 被 deleted| 前缀匹配", () => {
      const glFiles = [{ filename: "src/old.ts", status: "deleted" }];
      expect(filterFilesByIncludes(glFiles, [`deleted|${glob}`])).toHaveLength(1);
    });

    it("全量 diff 语义：文件在当前分支首次引入后被多次修改，status 仍为 added，added| 始终匹配", () => {
      // 场景：a.ts 在 commit1 创建（status=added），在 commit2 修改
      // 全量 diff（当前分支 vs base）时，compare API 返回的 status 仍为 added
      // 因此 added|*.ts 在后续每次 review 中都能匹配到该文件
      const diffFiles = [{ filename: "src/a.ts", status: "added" }];
      const result = filterFilesByIncludes(diffFiles, [`added|${glob}`]);
      expect(result.map((f) => f.filename)).toEqual(["src/a.ts"]);
    });
  });

  describe("extractGlobsFromIncludes", () => {
    it("无前缀的 glob 原样返回", () => {
      expect(extractGlobsFromIncludes(["**/*.ts", "!**/*.spec.ts"])).toEqual([
        "**/*.ts",
        "!**/*.spec.ts",
      ]);
    });

    it("有 status 前缀的 pattern 去掉前缀只返回 glob 部分", () => {
      expect(extractGlobsFromIncludes(["added|**/*.ts", "modified|**/*.vue"])).toEqual([
        "**/*.ts",
        "**/*.vue",
      ]);
    });

    it("混合模式只提取 glob 部分", () => {
      expect(extractGlobsFromIncludes(["**/*.ts", "added|**/*.vue", "!**/*.spec.ts"])).toEqual([
        "**/*.ts",
        "**/*.vue",
        "!**/*.spec.ts",
      ]);
    });

    it("空数组返回空数组", () => {
      expect(extractGlobsFromIncludes([])).toEqual([]);
    });
  });

  describe("extractCodeBlockTypes", () => {
    it("提取纯类型名", () => {
      const result = extractCodeBlockTypes(["function", "class"]);
      expect(result).toEqual(["function", "class"]);
    });

    it("status|code-* 语法不被识别，返回空", () => {
      const result = extractCodeBlockTypes(["added|code-function", "added|code-class"]);
      expect(result).toEqual([]);
    });

    it("混合：纯类型名保留，status 前缀语法忽略", () => {
      const result = extractCodeBlockTypes(["added|code-function", "class"]);
      expect(result).toEqual(["class"]);
    });

    it("去重：同一类型出现多次只返回一次", () => {
      const result = extractCodeBlockTypes(["function", "function"]);
      expect(result).toEqual(["function"]);
    });

    it("空数组返回空数组", () => {
      expect(extractCodeBlockTypes([])).toEqual([]);
    });
  });

  describe("matchIncludes", () => {
    const glob = "**/*.ts";

    it("includes 为空时返回 true", () => {
      expect(matchIncludes([], "src/foo.ts")).toBe(true);
    });

    it("filename 为空时返回 false", () => {
      expect(matchIncludes([glob], "")).toBe(false);
    });

    it("不传 fileStatus 时降级为纯 glob 匹配", () => {
      expect(matchIncludes([glob], "src/foo.ts")).toBe(true);
      expect(matchIncludes([glob], "src/foo.vue")).toBe(false);
    });

    it("不传 fileStatus 时 status 前缀降级为纯 glob 匹配", () => {
      // added|**/*.ts 在无 status 信息时，降级为 glob **/*.ts 匹配
      expect(matchIncludes([`added|${glob}`], "src/foo.ts")).toBe(true);
      expect(matchIncludes([`added|${glob}`], "src/foo.vue")).toBe(false);
    });

    it("无前缀 glob 不限 status，匹配所有符合的文件", () => {
      expect(matchIncludes([glob], "src/foo.ts", "added")).toBe(true);
      expect(matchIncludes([glob], "src/foo.ts", "modified")).toBe(true);
      expect(matchIncludes([glob], "src/foo.ts", "removed")).toBe(true);
    });

    it("added| 前缀只匹配 added 状态文件", () => {
      expect(matchIncludes([`added|${glob}`], "src/foo.ts", "added")).toBe(true);
      expect(matchIncludes([`added|${glob}`], "src/foo.ts", "modified")).toBe(false);
    });

    it("modified| 前缀只匹配 modified 状态文件", () => {
      expect(matchIncludes([`modified|${glob}`], "src/foo.ts", "modified")).toBe(true);
      expect(matchIncludes([`modified|${glob}`], "src/foo.ts", "added")).toBe(false);
    });

    it("deleted| 前缀匹配 removed 和 deleted 状态文件", () => {
      expect(matchIncludes([`deleted|${glob}`], "src/old.ts", "removed")).toBe(true);
      expect(matchIncludes([`deleted|${glob}`], "src/old.ts", "deleted")).toBe(true);
      expect(matchIncludes([`deleted|${glob}`], "src/old.ts", "modified")).toBe(false);
    });

    it("排除模式 ! 优先过滤", () => {
      expect(matchIncludes([glob, "!**/*.spec.ts"], "src/foo.spec.ts", "added")).toBe(false);
      expect(matchIncludes([glob, "!**/*.spec.ts"], "src/foo.ts", "added")).toBe(true);
    });

    it("排除目录 glob 时返回 false", () => {
      expect(matchIncludes(["**/*.js", "!public/**"], "public/foo.js", "modified")).toBe(false);
      expect(matchIncludes(["**/*.js", "!public/**"], "src/foo.js", "modified")).toBe(true);
    });

    it("不传 fileStatus 时也支持排除目录 glob", () => {
      expect(matchIncludes(["**/*.js", "!public/**"], "public/foo.js")).toBe(false);
      expect(matchIncludes(["**/*.js", "!public/**"], "src/foo.js")).toBe(true);
    });

    it("多个 status 前缀之间是 OR 关系", () => {
      expect(matchIncludes([`added|${glob}`, `modified|${glob}`], "src/foo.ts", "added")).toBe(
        true,
      );
      expect(matchIncludes([`added|${glob}`, `modified|${glob}`], "src/foo.ts", "modified")).toBe(
        true,
      );
    });

    it("无前缀 glob 与 status 前缀混用时任一命中即保留", () => {
      expect(matchIncludes([glob, "added|**/*.vue"], "src/foo.ts", "modified")).toBe(true);
      expect(matchIncludes([glob, "added|**/*.vue"], "src/foo.vue", "added")).toBe(true);
      expect(matchIncludes([glob, "added|**/*.vue"], "src/foo.vue", "modified")).toBe(false);
    });

    it("status 内排除语法 added|!**/*.spec.ts", () => {
      expect(matchIncludes([`added|${glob}`, "added|!**/*.spec.ts"], "src/foo.ts", "added")).toBe(
        true,
      );
      expect(
        matchIncludes([`added|${glob}`, "added|!**/*.spec.ts"], "src/foo.spec.ts", "added"),
      ).toBe(false);
    });

    it("fileStatus 为 undefined 时走降级路径（纯 glob 匹配）", () => {
      // matchIncludes 中 undefined 表示无 status 信息，降级为纯 glob 匹配
      // 这与 filterFilesByIncludes 中 status=undefined fallback 为 modified 不同
      // 因为 matchIncludes 用于 spec includes 场景，无 status 时应宽松匹配
      expect(matchIncludes([`modified|${glob}`], "src/foo.ts")).toBe(true);
      expect(matchIncludes([`added|${glob}`], "src/foo.ts")).toBe(true);
    });
  });
});
