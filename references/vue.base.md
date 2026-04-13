# Vue 基础代码 `[Vue.Base]`

> - includes `*.vue`

## Vue 自定义组件命名规则 `[Vue.Base.CustomComponentName]`

必须使用大驼峰命名并且使用的时候也是，并且至少两个单词。

### Example: Vue 自定义组件命名规则

#### Good: 合理的命名

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

#### Bad: 不合理的命名

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
