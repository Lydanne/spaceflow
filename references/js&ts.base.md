# 基础代码规范 `[JsTs.Base]`

下面是 JS/TS 的代码规范

## 常量名使用大写加下划线命名（UPPER_CASE），单词间以下划线分隔 `[JsTs.Base.ConstUpperCase]`

- 不检查 nodejs 的导包定义，比如 `const fs = require("fs")`
- 常量检查只需检查 `const` 声明的静态值，但是不包含对象和函数

### Good

```javascript
const MAX_COUNT = 100;
```

### Bad

```javascript
const maxCount = 100;
```

## 函数名使用小驼峰命名 `[JsTs.Base.FuncLowerCamel]`

> - severity `warn`

### Good

```javascript
function getUserInfo() {
  // ...
}
```

### Bad

```javascript
function getuserinfo() {
  // ...
}
```

## 禁止使用字面量魔法字符串和魔法数字 `[JsTs.Base.NoMagicStringsAndNumbers]`

> - severity `warn`

- 只检查数字、字符串、正则字面量，不要检查其他（比如 布尔字面量、对象字面量、函数字面量、数组字面量）
- 这块只检查含义不明确的字面量，比如 0 1 500 等，像是 'user' 'admin' 'active' 'inactive' 等是合理的
- 无需检查单词是否完整拼写
- throw 的错误信息无需审查
- new Error 的错误信息无需审查
- console.log 的打印代码无需审查
- console.error 的错误信息无需审查
- console.warn 的错误信息无需审查
- console.info 的错误信息无需审查
- console.debug 的错误信息无需审查
- console.trace 的错误信息无需审查
- 无需考虑类型是否合理匹配

### Good

```javascript
const MAX_COUNT = 100;
```

### Bad

```javascript
const maxCount = 100;
const userStatus = "active";
```

## class 和 interface 命名使用大驼峰命名 `[JsTs.Base.ClassUpperCamel]`

> - severity `warn`

### Good

```javascript
class UserInfo {
  // ...
}
```

### Bad

```javascript
class userinfo {
  // ...
}
```

## 变量名使用小驼峰命名 `[JsTs.Base.VarLowerCamel]`

> - severity `warn`

- 需要注意的是从 require 导入的变量不受检查

### Good

```javascript
let userName = "John";
```

### Bad

```javascript
let username = "John";
```

## 单文件代码不超过 700 行 `[JsTs.Base.CodeNotMoreThan700Lines]`

### Good

```javascript
// 代码不超过 700 行
```

### Bad

```javascript
// 代码超过 700 行
```

## 单个函数或方法不能超出 200 行 `[JsTs.Base.FuncNotMoreThan200Lines]`

### Good

```javascript
function getUserInfo() {
  // ... 小于等于 200
}
```

### Bad

```javascript
function getUserInfo() {
  // ... 大于 200
}
```

## 复杂的逻辑判断要添加注释 `[JsTs.Base.ComplexLogic]`

> - severity `warn`

- 逻辑判断的复杂度超过 2 个的要添加注释

### Good

```javascript
// 逻辑判断复杂度超过 2 个
if (a && b || c) {
  // ...
}
```

### Bad

```javascript
if (a && b && c && d) {
  // ...
}
```

## 复杂的函数要添加注释 `[JsTs.Base.ComplexFunc]`

> - severity `warn`

### Good

```javascript
/**
 * 复杂的算法逻辑
 */
function complexFunc() {
  // ... 
}
```

### Bad

```javascript
function complexFunc() {
  // ... 
}
```
