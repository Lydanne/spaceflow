# Vue 文件命名 `[Vue.FileName]`

> - includes `*.vue`

## Vue 组件文件使用大驼峰命名 `[Vue.FileName.UpperCamel]`

### Example: Vue 组件文件使用大驼峰命名

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
