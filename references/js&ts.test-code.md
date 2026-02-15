# 测试代码规范 `[JsTs.TestCode]`

下面是 JS/TS 的测试代码规范.

## 测试文件命名 `[JsTs.TestCode.FileName]`

- 必须以 `.test.js` 或 `.test.ts`（或 `.spec.ts`）结尾。
- 前缀部分应与被测试源文件名保持一致。

### Good

```javascript
// userInfo.js
// userInfo.test.js
describe("UserInfo", () => {
  // ...
});
```

### Bad

```javascript
// userInfo.js
// userinfo.test.js
describe("userinfo", () => {
  // ...
});
```

## 测试代码块命名 `[JsTs.TestCode.BlockName]`

- 测试代码命名结构：`describe(文件名)` -> `describe(函数名/类名.方法名)` -> `it(场景描述)`。
- 场景描述应使用 "should ..." 格式，描述预期行为。

### Good

```javascript
// uUerInfo.js
export class UserInfo {
  getUserInfo() {
    // ...
  }
}

// userInfo.test.js
describe("UserInfo", () => {
  describe("UserInfo.getUserInfo", () => {
    it("should return user info", () => {
      // ...
    });
  });
});
```

```javascript
// userInfo.js
export function getUserInfo() {
  // ...
}

// userInfo.test.js
describe("userInfo", () => {
  describe("getUserInfo", () => {
    it("should return user info", () => {
      // ...
    });
  });
});
```

### Bad

```javascript
// userInfo.js
export function getUserInfo() {
  // ...
}

// userInfo.test.js
describe("userInfo", () => {
  it("should return user info", () => {
    // ...
  });
});
```
