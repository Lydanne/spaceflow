# review-summary — 审查统计

`review-summary` 是 Spaceflow 的周期统计扩展，根据时间范围统计仓库中已合并 PR 的贡献情况，按人员汇总并排序。支持输出到控制台、Git Issue 或 Markdown 文件。

## 安装

```bash
spaceflow install @spaceflow/review-summary
```

## 基本用法

```bash
# 使用时间预设 — 统计本周
spaceflow review-summary -p this-week

# 统计上月
spaceflow review-summary -p last-month

# 自定义日期范围
spaceflow review-summary -s 2026-01-01 -u 2026-01-31

# 输出为 Markdown 格式
spaceflow review-summary -p last-week --format markdown

# 输出到 Git Issue（需要 CI 环境或 Git Token）
spaceflow review-summary -p last-week -o issue -c

# 输出到文件
spaceflow review-summary -p this-month -o file --output-file report.md
```

## 功能特性

- **时间范围统计** — 支持 7 种预设时间段或自定义日期范围
- **多维度统计** — PR 数量、新增/删除代码行数、变更文件数、审查问题数
- **综合评分** — 根据代码量、问题数量等多维度加权计算贡献分数
- **按人员排序** — 按综合分数降序排列贡献者
- **功能摘要** — 自动提取每个 PR 的标题作为功能描述
- **问题统计** — 从 PR 评论中提取 AI 审查发现的问题数和修复数
- **多种输出** — 控制台表格、Markdown、JSON 三种格式，支持输出到控制台、Git Issue 或文件

## 命令行选项

| 选项                        | 简写 | 说明                                           |
| --------------------------- | ---- | ---------------------------------------------- |
| `--preset <preset>`         | `-p` | 时间预设                                       |
| `--since <date>`            | `-s` | 起始日期（`YYYY-MM-DD` 格式）                  |
| `--until <date>`            | `-u` | 截止日期（`YYYY-MM-DD` 格式），默认今天        |
| `--repository <owner/repo>` |      | 仓库路径，默认从环境变量获取                   |
| `--format <format>`         |      | 输出格式：`table`（默认）/ `markdown` / `json` |
| `--output <target>`         | `-o` | 输出目标：`console`（默认）/ `issue` / `file`  |
| `--output-file <path>`      |      | 输出文件路径（当 `--output file` 时使用）      |
| `--ci`                      | `-c` | 在 CI 环境中运行                               |
| `--verbose`                 | `-v` | 详细日志                                       |

## 时间预设

| 预设           | 说明                    |
| -------------- | ----------------------- |
| `this-week`    | 本周一至今天            |
| `last-week`    | 上周一至上周日          |
| `this-month`   | 本月 1 日至今天         |
| `last-month`   | 上月 1 日至上月最后一天 |
| `last-7-days`  | 最近 7 天               |
| `last-15-days` | 最近 15 天              |
| `last-30-days` | 最近 30 天              |

## 评分算法

综合分数由以下维度加权计算：

| 维度       | 权重            | 说明                         |
| ---------- | --------------- | ---------------------------- |
| PR 基础分  | **+10** / PR    | 每个已合并 PR 的基础贡献分   |
| 新增代码   | **+2** / 100 行 | 鼓励有效代码产出             |
| 删除代码   | **+1** / 100 行 | 鼓励代码清理，但权重低于新增 |
| 变更文件   | **+0.5** / 文件 | 反映影响范围                 |
| 未修复问题 | **-3** / 个     | 对审查发现但未修复的问题扣分 |
| 已修复问题 | **+1** / 个     | 对积极修复问题给予加分       |

> **公式**: `分数 = PR基础分 + 新增代码分 + 删除代码分 + 文件分 - 未修复扣分 + 已修复加分`（最低 0 分）

## 输出示例

### 控制台表格格式（默认）

```text
📊 周期统计报告
────────────────────────────────────────────────────────────
📦 仓库: example-org/web-app
📅 周期: 2026-02-24 ~ 2026-03-02
📝 合并 PR 数: 8

🏆 贡献者排名
────────────────────────────────────────────────────────────
排名 │ 用户            │  PR数 │     新增 │     删除 │ 问题 │     分数
────────────────────────────────────────────────────────────
#1   │ alice           │     3 │    +1250 │     -320 │    2 │     70.2
#2   │ bob             │     3 │     +680 │     -150 │    5 │     40.9
#3   │ charlie         │     2 │     +340 │      -80 │    0 │     34.6
────────────────────────────────────────────────────────────

📋 功能摘要
────────────────────────────────────────────────────────────

👤 alice:
   • 实现用户权限管理模块
   • 修复登录页面样式问题
   • 优化数据库查询性能

👤 bob:
   • 新增订单导出功能
   • 重构支付流程
   • 添加单元测试覆盖

👤 charlie:
   • 升级依赖版本
   • 修复国际化翻译缺失
```

### Markdown 格式

```markdown
# 📊 周期统计报告

- **仓库**: example-org/web-app
- **周期**: 2026-02-24 ~ 2026-03-02
- **合并 PR 数**: 8

## 🏆 贡献者排名

| 排名 | 用户    | PR数 | 新增  | 删除 | 问题 | 分数 |
| ---- | ------- | ---- | ----- | ---- | ---- | ---- |
| #1   | alice   | 3    | +1250 | -320 | 2    | 70.2 |
| #2   | bob     | 3    | +680  | -150 | 5    | 40.9 |
| #3   | charlie | 2    | +340  | -80  | 0    | 34.6 |

## 📋 功能摘要

### 👤 alice

- 实现用户权限管理模块
- 修复登录页面样式问题
- 优化数据库查询性能

### 👤 bob

- 新增订单导出功能
- 重构支付流程
- 添加单元测试覆盖

### 👤 charlie

- 升级依赖版本
- 修复国际化翻译缺失
```

### JSON 格式

```json
{
  "period": {
    "since": "2026-02-24",
    "until": "2026-03-02"
  },
  "repository": "example-org/web-app",
  "totalPrs": 8,
  "userStats": [
    {
      "username": "alice",
      "prCount": 3,
      "totalAdditions": 1250,
      "totalDeletions": 320,
      "totalChangedFiles": 28,
      "totalIssues": 2,
      "totalFixed": 1,
      "score": 70.2,
      "features": [
        "实现用户权限管理模块",
        "修复登录页面样式问题",
        "优化数据库查询性能"
      ],
      "prs": [
        {
          "number": 142,
          "title": "[Feature] 实现用户权限管理模块",
          "author": "alice",
          "mergedAt": "2026-02-28T10:30:00Z",
          "additions": 850,
          "deletions": 120,
          "changedFiles": 15,
          "issueCount": 2,
          "fixedCount": 1,
          "description": "实现用户权限管理模块"
        }
      ]
    }
  ]
}
```

### 分数计算演示

以 alice 为例（3 PR, +1250 行, -320 行, 28 文件, 2 问题, 1 已修复）：

```text
PR 基础分:    3 × 10             = 30.0
新增代码:     1250 / 100 × 2     = 25.0
删除代码:     320 / 100 × 1      =  3.2
变更文件:     28 × 0.5           = 14.0
未修复扣分:   (2 - 1) × 3        = -3.0
已修复加分:   1 × 1              =  1.0
─────────────────────────────────────
总分:         30 + 25 + 3.2 + 14 - 3 + 1 = 70.2
```

## 数据来源

统计数据通过 Git Provider API 获取：

| 数据     | 来源                                                       |
| -------- | ---------------------------------------------------------- |
| PR 列表  | `listAllPullRequests` — 筛选时间范围内已合并的 PR          |
| 代码行数 | `getPullRequestFiles` — 统计每个文件的 additions/deletions |
| 问题统计 | `listIssueComments` — 从 AI 审查评论中正则提取问题数       |
| 功能描述 | PR 标题 — 自动去除 `[Tag]` 前缀                            |

## 环境变量

| 变量                           | 说明                                                        |
| ------------------------------ | ----------------------------------------------------------- |
| `GITHUB_TOKEN` / `GITEA_TOKEN` | Git Provider API Token                                      |
| `GITHUB_REPOSITORY`            | 仓库名称（`owner/repo` 格式），也可通过 `--repository` 指定 |

## CI 集成

在 Gitea/GitHub Actions 中定期生成统计报告：

```yaml
name: Weekly Review Summary
on:
  schedule:
    - cron: "0 9 * * 1" # 每周一 9:00
jobs:
  summary:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx @spaceflow/cli review-summary -p last-week -o issue -c
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITHUB_REPOSITORY: ${{ github.repository }}
```
