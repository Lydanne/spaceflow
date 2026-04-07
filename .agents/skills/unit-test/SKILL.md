---
name: unit-test
description: Write compliant Vitest unit tests for the spaceflow project.
---
# unit-test

为 spaceflow 项目编写符合规范的 Vitest 单元测试。

## 规范

### 文件结构

- 测试文件放在被测文件同目录，命名为 `<filename>.spec.ts`
- 顶层只有**一个** `describe("文件相对路径")`，路径为相对 `src/` 的路径，例如 `"utils/review-llm"`
- 所有函数的测试各自在一个子 `describe("<函数名>")` 块内
- 不使用辅助工厂函数，数据直接内联在每个 `it` 块中
- 每个 `describe` 块顶部可以声明 `const` 共享的测试数据（适合多个 `it` 复用同一组输入）

### 测试用例

- 每个 `it` 描述一个具体行为，用中文描述，格式："条件/输入 → 预期输出"
- 优先使用 `toEqual` / `toBe` 断言精确值，避免仅用 `toHaveLength`
- 边界用例必须覆盖：空输入、`undefined`/`null` 参数、越界值、无匹配情况
- 负向断言用 `not.toContain` / `not.toEqual`，不单独写空测试

### import

- 只导入 `describe`、`it`、`expect` from `"vitest"`
- 被测函数全部从相对路径导入，不使用 alias

### 禁止

- 不使用 `beforeEach` / `afterEach` 做全局 mock（除非测试需要副作用）
- 不创建辅助工厂函数（`makeLines`、`buildFoo` 等），数据直接内联
- 不写空实现或 `TODO` 占位测试
- 不在 `it` 描述中使用英文

## 示例

参考 `src/review-includes-filter.spec.ts` 的完整结构：

```ts
import { describe, it, expect } from "vitest";
import { myFunction } from "./my-module";

describe("my-module", () => {
  describe("myFunction", () => {
    const sharedInput = ["a", "b", "c"];

    it("正常输入时返回预期结果", () => {
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
