# shell — Shell 执行

`shell` 命令用于在 CI 环境中执行自定义 Shell 命令。

## 安装

```bash
spaceflow install @spaceflow/shell
```

## 基本用法

```bash
# 执行 Shell 命令
spaceflow shell "npm test"

# CI 模式
spaceflow shell "npm run build" --dry-run
```

## 使用场景

- 在 CI 中执行任意 Shell 命令
- 通过 GitHub Actions 触发自定义命令
- 配合飞书机器人远程执行命令

## 命令行选项

| 选项        | 说明                |
| ----------- | ------------------- |
| `--dry-run` | 跳过 Shell 命令执行 |
