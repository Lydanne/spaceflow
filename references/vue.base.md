# Vue 基础代码 `[Vue.Base]`

> - includes `*.vue`

## Vue 自定义组件命名规则 `[Vue.Base.CustomComponentName]`

必须使用大驼峰命名并且使用的时候也是，并且至少两个单词。

### Good

```vue
<!-- UserInfo.vue -->
<template>
  <div></div>
</template>

<script>
export default {
  name: "UserInfo",
  // ...
};
</script>
```

### Bad

```vue
<!-- userinfo.vue -->
<template>
  <div></div>
</template>

<script>
export default {
  name: "userinfo",
  // ...
};
</script>
```
