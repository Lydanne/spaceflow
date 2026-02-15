# 文件命名规范 `[JsTs.FileName]`

下面是 JS/TS 的文件命名规范.

## class 和 interface 文件使用大驼峰命名 `[JsTs.FileName.UpperCamel]`

- 文件名必须与主导类或接口名称完全一致。
- 适用于定义单一主要实体的文件。

### Good

```javascript
// UserInfo.js
class UserInfo {
  // ...
}
```

### Bad

```javascript
// userinfo.js
class userinfo {
  // ...
}
```

## 函数文件使用小驼峰命名 `[JsTs.FileName.LowerCamel]`

- 适用于导出一个或多个工具函数的文件。
- 文件名应反映其包含的核心功能。

### Good

```javascript
// getUserInfo.js
function getUserInfo() {
  // ...
}
```

### Bad

```javascript
// getuserinfo.js
function getuserinfo() {
  // ...
}
```
