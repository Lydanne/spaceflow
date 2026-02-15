# Vue 文件命名 `[Vue.FileName]`

> - includes `*.vue`

## Vue 组件文件使用大驼峰命名 `[Vue.FileName.UpperCamel]`

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
