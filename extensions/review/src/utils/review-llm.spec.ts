import { describe, it, expect } from "vitest";
import { buildLinesWithNumbers, buildCommitsSection, extractCodeBlocks } from "./review-llm";

describe("utils/review-llm", () => {
  describe("buildLinesWithNumbers", () => {
    const lines: [string, string][] = [
      ["abc1234", "line one"],
      ["-------", "line two"],
      ["abc1234", "line three"],
    ];

    it("无 visibleRanges 时输出全部行，带行号和 hash", () => {
      expect(buildLinesWithNumbers(lines)).toBe(
        "abc1234 1| line one\n------- 2| line two\nabc1234 3| line three",
      );
    });

    it("行号宽度按总行数自动 pad（10 行时个位行号前有空格）", () => {
      const tenLines: [string, string][] = Array.from({ length: 10 }, (_, i) => [
        "abc1234",
        `line ${i + 1}`,
      ]);
      const result = buildLinesWithNumbers(tenLines);
      expect(result.split("\n")[0]).toContain(" 1|");
      expect(result.split("\n")[9]).toContain("10|");
    });

    it("visibleRanges 为空数组时等价于无 visibleRanges，输出全部行", () => {
      expect(buildLinesWithNumbers(lines, [])).toBe(buildLinesWithNumbers(lines));
    });

    it("只指定首行时，末尾被忽略区间产生 ignore 占位", () => {
      const result = buildLinesWithNumbers(lines, [[1, 1]]);
      expect(result).toBe("abc1234 1| line one\n....... ignore 2-3 line .......");
    });

    it("只指定末行时，开头被忽略区间产生 ignore 占位", () => {
      const result = buildLinesWithNumbers(lines, [[3, 3]]);
      expect(result).toBe("....... ignore 1-2 line .......\nabc1234 3| line three");
    });

    it("只指定中间行时，前后均产生 ignore 占位", () => {
      const result = buildLinesWithNumbers(lines, [[2, 2]]);
      expect(result).toBe(
        "....... ignore 1-1 line .......\n------- 2| line two\n....... ignore 3-3 line .......",
      );
    });

    it("多个不相邻范围各自产生 ignore 占位", () => {
      const fiveLines: [string, string][] = [
        ["abc1234", "a"],
        ["-------", "b"],
        ["abc1234", "c"],
        ["-------", "d"],
        ["abc1234", "e"],
      ];
      const result = buildLinesWithNumbers(fiveLines, [
        [1, 1],
        [5, 5],
      ]);
      expect(result).toBe("abc1234 1| a\n....... ignore 2-4 line .......\nabc1234 5| e");
    });

    it("重叠的 visibleRanges 合并后不产生 ignore 占位", () => {
      const result = buildLinesWithNumbers(lines, [
        [1, 2],
        [2, 3],
      ]);
      expect(result).not.toContain("ignore");
      expect(result.split("\n")).toHaveLength(3);
    });

    it("visibleRanges 超出文件范围时自动裁剪，不产生 ignore 占位", () => {
      const result = buildLinesWithNumbers(lines, [[0, 100]]);
      expect(result).not.toContain("ignore");
      expect(result.split("\n")).toHaveLength(3);
    });

    it("visibleRanges 无序时按起始行号排序后正常输出", () => {
      const result = buildLinesWithNumbers(lines, [
        [3, 3],
        [1, 1],
      ]);
      expect(result).toBe(
        "abc1234 1| line one\n....... ignore 2-2 line .......\nabc1234 3| line three",
      );
    });
  });

  describe("extractCodeBlocks", () => {
    it("types 为空时返回空数组", () => {
      expect(extractCodeBlocks([["abc1234", "function foo() {}"]], [])).toEqual([]);
    });

    it("空 contentLines 返回空数组", () => {
      expect(extractCodeBlocks([], ["function"])).toEqual([]);
    });

    it("全为上下文行时返回空数组", () => {
      const lines: [string, string][] = [
        ["-------", "function foo() { }"],
        ["-------", "class Bar { }"],
      ];
      expect(extractCodeBlocks(lines, ["function", "class"])).toEqual([]);
    });

    it("提取新增的单行 function", () => {
      expect(
        extractCodeBlocks([["abc1234", "function foo() { return 1; }"]], ["function"]),
      ).toEqual([[1, 1]]);
    });

    it("提取新增的多行 function", () => {
      const lines: [string, string][] = [
        ["abc1234", "function foo() {"],
        ["abc1234", "  return 1;"],
        ["abc1234", "}"],
      ];
      expect(extractCodeBlocks(lines, ["function"])).toEqual([[1, 3]]);
    });

    it("提取 export function", () => {
      expect(extractCodeBlocks([["abc1234", "export function hello() { }"]], ["function"])).toEqual(
        [[1, 1]],
      );
    });

    it("提取 async function", () => {
      expect(extractCodeBlocks([["abc1234", "async function load() { }"]], ["function"])).toEqual([
        [1, 1],
      ]);
    });

    it("上下文行中的 function 不被提取，只提取新增行中的", () => {
      const lines: [string, string][] = [
        ["-------", "function foo() {"],
        ["-------", "  return 1;"],
        ["-------", "}"],
        ["abc1234", "function bar() { return 2; }"],
      ];
      expect(extractCodeBlocks(lines, ["function"])).toEqual([[4, 4]]);
    });

    it("提取多行 class 代码块", () => {
      const lines: [string, string][] = [
        ["abc1234", "class Foo {"],
        ["abc1234", "  bar() {}"],
        ["abc1234", "}"],
      ];
      expect(extractCodeBlocks(lines, ["class"])).toEqual([[1, 3]]);
    });

    it("提取 export class", () => {
      expect(extractCodeBlocks([["abc1234", "export class Bar { }"]], ["class"])).toEqual([[1, 1]]);
    });

    it("提取多行 interface", () => {
      const lines: [string, string][] = [
        ["abc1234", "export interface IFoo {"],
        ["abc1234", "  name: string;"],
        ["abc1234", "}"],
      ];
      expect(extractCodeBlocks(lines, ["interface"])).toEqual([[1, 3]]);
    });

    it("提取 type 别名（含 =）", () => {
      expect(
        extractCodeBlocks([["abc1234", "export type MyType = string | number;"]], ["type"]),
      ).toEqual([[1, 1]]);
    });

    it("提取泛型 type（含 <）", () => {
      expect(extractCodeBlocks([["abc1234", "type Result<T> = { data: T };"]], ["type"])).toEqual([
        [1, 1],
      ]);
    });

    it("同时提取 function 和 class，中间上下文行不影响结果", () => {
      const lines: [string, string][] = [
        ["abc1234", "function foo() { }"],
        ["-------", "const x = 1;"],
        ["abc1234", "class Bar { }"],
      ];
      expect(extractCodeBlocks(lines, ["function", "class"])).toEqual([
        [1, 1],
        [3, 3],
      ]);
    });

    it("相邻代码块合并为一个范围", () => {
      const lines: [string, string][] = [
        ["abc1234", "function a() {"],
        ["abc1234", "}"],
        ["abc1234", "function b() {"],
        ["abc1234", "}"],
      ];
      expect(extractCodeBlocks(lines, ["function"])).toEqual([[1, 4]]);
    });

    it("嵌套括号时找到最外层封闭括号作为结尾", () => {
      const lines: [string, string][] = [
        ["abc1234", "function outer() {"],
        ["abc1234", "  if (true) {"],
        ["abc1234", "    inner();"],
        ["abc1234", "  }"],
        ["abc1234", "}"],
      ];
      expect(extractCodeBlocks(lines, ["function"])).toEqual([[1, 5]]);
    });

    it("method：public 修饰的方法识别为完整代码块", () => {
      const lines: [string, string][] = [
        ["abc1234", "  public getName() {"],
        ["abc1234", "    return this.name;"],
        ["abc1234", "  }"],
      ];
      expect(extractCodeBlocks(lines, ["method"])).toEqual([[1, 3]]);
    });

    it("method：async 方法识别为完整代码块", () => {
      const lines: [string, string][] = [
        ["abc1234", "  async fetchData() {"],
        ["abc1234", "    return await api();"],
        ["abc1234", "  }"],
      ];
      expect(extractCodeBlocks(lines, ["method"])).toHaveLength(1);
    });
  });

  describe("buildCommitsSection", () => {
    const lines: [string, string][] = [
      ["abc1234", "const x = 1;"],
      ["-------", "const y = 2;"],
      ["def5678", "const z = 3;"],
    ];

    it("有匹配 commit 时返回 markdown 列表（- `hash` 首行消息）", () => {
      const commits = [
        { sha: "abc1234abcdef", commit: { message: "feat: add x\n详细说明" } },
        { sha: "def5678abcdef", commit: { message: "fix: fix z" } },
      ] as any;
      const result = buildCommitsSection(lines, commits);
      expect(result).toContain("- `abc1234` feat: add x");
      expect(result).toContain("- `def5678` fix: fix z");
    });

    it("commit 消息只取第一行，忽略后续内容", () => {
      const commits = [
        { sha: "abc1234abc", commit: { message: "first line\nsecond line\nthird line" } },
      ] as any;
      expect(buildCommitsSection(lines, commits)).toBe("- `abc1234` first line");
    });

    it("没有匹配 commit 时返回默认文案", () => {
      const commits = [{ sha: "xxxxxxxxxxxxxxx", commit: { message: "unrelated" } }] as any;
      expect(buildCommitsSection(lines, commits)).toBe("- 无相关 commits");
    });

    it("commits 为空数组时返回默认文案", () => {
      expect(buildCommitsSection(lines, [])).toBe("- 无相关 commits");
    });

    it("contentLines 全为上下文行时返回默认文案", () => {
      const ctxLines: [string, string][] = [
        ["-------", "line 1"],
        ["-------", "line 2"],
      ];
      const commits = [{ sha: "abc1234abc", commit: { message: "msg" } }] as any;
      expect(buildCommitsSection(ctxLines, commits)).toBe("- 无相关 commits");
    });

    it("commit sha 为 undefined 时不崩溃，返回默认文案", () => {
      const commits = [{ sha: undefined, commit: { message: "msg" } }] as any;
      expect(buildCommitsSection(lines, commits)).toBe("- 无相关 commits");
    });
  });
});
