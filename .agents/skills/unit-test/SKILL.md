---
name: unit-test
description: Write compliant Vitest unit tests for the spaceflow project.
---
# unit-test

为 Spaceflow 项目编写或修改 Vitest 单元测试时使用。

## 必守结构

- 测试文件放在被测文件同目录，命名为 `<filename>.spec.ts`。
- 顶层只有一个 `describe("文件相对路径")`，路径相对 `src/`，例如 `"utils/review-llm"`。
- 所有函数的测试各自在一个子 `describe("<函数名>")` 块内
- 每个 `it` 描述一个具体行为，使用中文，例如 `"空输入时返回空数组"`。
- 只从 `"vitest"` 导入 `describe`、`it`、`expect`。
- 被测对象使用相对路径导入，不使用 alias。

## 断言要求

- 优先使用 `toEqual` / `toBe` 断言精确值，避免只用 `toHaveLength`。
- 边界用例按风险覆盖：空输入、`undefined` / `null`、越界值、无匹配情况。
- 负向断言用 `not.toContain` / `not.toEqual`，不要写空测试。

## 禁止

- 不使用 `beforeEach` / `afterEach` 做全局 mock，除非测试确实需要副作用。
- 不创建 `makeXxx` / `buildXxx` 这类辅助工厂；数据直接内联，或放在 `describe` 顶部的 `const`。
- 不写 TODO、空实现或英文 `it` 描述。

## 示例

参考 `src/review-includes-filter.spec.ts` 的完整结构：

```ts
import { describe, it, expect } from "vitest";
import { myFunction } from "./my-module";

describe("my-module", () => {
  describe("myFunction", () => {
    const sharedInput = ["a", "b", "c"];

    it("正常输入时返回大写结果", () => {
      expect(myFunction(sharedInput)).toEqual(["A", "B", "C"]);
    });

    it("空数组时返回空数组", () => {
      expect(myFunction([])).toEqual([]);
    });

    it("包含无效值时过滤掉并返回剩余结果", () => {
      expect(myFunction(["a", "", "c"])).toEqual(["A", "C"]);
    });
  });
});
```
