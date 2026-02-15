# @spaceflow/ci-scripts

Spaceflow CI 脚本插件，在分支锁定/解锁保护下执行 JavaScript 语句。适用于 CI 环境中需要原子性执行脚本的场景。

## 安装

```bash
pnpm spaceflow install @spaceflow/ci-scripts
```

## 使用

```bash
# 执行 JS 表达式
spaceflow ci-scripts -e "console.log('hello')"

# CI 模式
spaceflow ci-scripts --ci -e "await fetch('https://api.example.com/deploy')"

# 仅预览，不实际执行
spaceflow ci-scripts --dry-run -e "console.log('test')"
```

## 命令行参数

| 参数                  | 简写 | 说明                 |
| --------------------- | ---- | -------------------- |
| `--expression <code>` | `-e` | 要执行的 JS 表达式   |
| `--ci`                | `-c` | 在 CI 环境中运行     |
| `--dry-run`           | `-d` | 仅打印将要执行的操作 |

## 工作流程

1. **锁定分支** — 创建分支保护规则，防止其他推送干扰
2. **执行脚本** — 运行指定的 JavaScript 语句
3. **解锁分支** — 删除保护规则，恢复正常状态

## 环境变量

| 变量                | 说明                          |
| ------------------- | ----------------------------- |
| `GITHUB_TOKEN`      | GitHub API Token              |
| `GITHUB_REPOSITORY` | 仓库名称（`owner/repo` 格式） |
| `GITHUB_REF_NAME`   | 当前分支名称                  |

## 许可证

[MIT](../../LICENSE)
