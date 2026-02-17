# @spaceflow/shell

[![npm version](https://img.shields.io/npm/v/@spaceflow/shell?color=blue)](https://www.npmjs.com/package/@spaceflow/shell)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> Spaceflow Shell 扩展，在分支锁定/解锁保护下执行 Shell 命令。适用于 CI 环境中需要原子性执行命令的场景。

## 安装

```bash
pnpm spaceflow install @spaceflow/shell
```

## 使用

```bash
# 执行 Shell 命令
spaceflow shell -e "npm run deploy"

# CI 模式
spaceflow shell --ci -e "pnpm build && pnpm test"

# 仅预览，不实际执行
spaceflow shell --dry-run -e "echo 'test'"
```

## 命令行参数

| 参数                 | 简写 | 说明                 |
| -------------------- | ---- | -------------------- |
| `--expression <cmd>` | `-e` | 要执行的 Shell 命令  |
| `--ci`               | `-c` | 在 CI 环境中运行     |
| `--dry-run`          | `-d` | 仅打印将要执行的操作 |

## 工作流程

1. **锁定分支** — 创建分支保护规则，防止其他推送干扰
2. **执行命令** — 运行指定的 Shell 命令
3. **解锁分支** — 删除保护规则，恢复正常状态

## 环境变量

| 变量                | 说明                          |
| ------------------- | ----------------------------- |
| `GITHUB_TOKEN`      | GitHub API Token              |
| `GITHUB_REPOSITORY` | 仓库名称（`owner/repo` 格式） |
| `GITHUB_REF_NAME`   | 当前分支名称                  |

## 许可证

[MIT](../../LICENSE)
