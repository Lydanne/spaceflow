# dev — 开发模式

以监听模式构建 Extension，文件变化时自动重新编译。等价于 `spaceflow build --watch`。

## 基本用法

```bash
# 监听并构建所有 Extension
spaceflow dev

# 监听并构建指定 Extension
spaceflow dev review
```

## 与 build --watch 的关系

`dev` 命令是 `build --watch` 的快捷方式，内部调用相同的 `BuildService.watch()` 方法。

```bash
spaceflow dev          # 等价于 spaceflow build --watch
spaceflow dev review   # 等价于 spaceflow build review --watch
```

## 使用场景

- 开发新 Extension 时，实时编译查看效果
- 调试 Extension 代码，修改后自动重新构建

## 命令行选项

| 选项 | 简写 | 说明 |
|------|------|------|
| `--verbose` | `-v` | 详细日志 |
