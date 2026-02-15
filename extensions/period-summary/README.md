# @spaceflow/period-summary

[![npm version](https://img.shields.io/npm/v/@spaceflow/period-summary?color=blue)](https://www.npmjs.com/package/@spaceflow/period-summary)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> Spaceflow 周期统计扩展，根据时间范围统计 PR 贡献情况，按人员汇总并排序。支持输出到控制台、GitHub Issue 或 Markdown 文件。

## 安装

```bash
pnpm spaceflow install @spaceflow/period-summary
```

## 功能特性

- **时间范围统计** — 支持自定义日期范围或预设时间段
- **多维度统计** — PR 数量、代码行数、变更文件数、问题数量
- **综合评分** — 根据代码量和问题数量权衡计算分数
- **按人员排序** — 按综合分数降序排列贡献者
- **多种输出方式** — 控制台、GitHub Issue、Markdown 文件

## 使用

```bash
# 使用时间预设 - 统计本周
spaceflow period-summary -p this-week

# 使用时间预设 - 统计上月
spaceflow period-summary -p last-month

# 自定义日期范围
spaceflow period-summary -s 2026-01-01 -u 2026-01-18

# 输出到 GitHub Issue
spaceflow period-summary -p last-week -o issue -c
```

## 命令行参数

| 参数                | 简写 | 说明                                                                |
| ------------------- | ---- | ------------------------------------------------------------------- |
| `--period <preset>` | `-p` | 时间预设（`this-week` / `last-week` / `this-month` / `last-month`） |
| `--since <date>`    | `-s` | 起始日期（`YYYY-MM-DD` 格式）                                       |
| `--until <date>`    | `-u` | 截止日期（`YYYY-MM-DD` 格式）                                       |
| `--output <format>` | `-o` | 输出方式（`console` / `issue` / `markdown`）                        |
| `--ci`              | `-c` | 在 CI 环境中运行                                                    |
| `--dry-run`         | `-d` | 仅打印将要执行的操作                                                |

## 环境变量

| 变量                | 说明                          |
| ------------------- | ----------------------------- |
| `GITHUB_TOKEN`      | GitHub API Token              |
| `GITHUB_REPOSITORY` | 仓库名称（`owner/repo` 格式） |

## 许可证

[MIT](../../LICENSE)
