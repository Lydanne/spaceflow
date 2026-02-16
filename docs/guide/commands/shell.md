# shell — Shell 执行

`shell` 命令用于在 CI 环境中执行自定义 Shell 命令。

## 安装

```bash
spaceflow install @spaceflow/shell
```

## 基本用法

```bash
# 执行 Shell 命令
spaceflow shell --command "npm test"

# CI 模式
spaceflow shell --command "npm run build" --ci
```

## 使用场景

- 在 CI 中执行任意 Shell 命令
- 通过 GitHub Actions 触发自定义命令
- 配合飞书机器人远程执行命令

## 命令行选项

| 选项              | 说明                |
| ----------------- | ------------------- |
| `--command <cmd>` | 要执行的 Shell 命令 |
| `--ci`            | CI 模式             |
| `--dry-run`       | 试运行              |
| `--verbose`       | 详细日志            |
