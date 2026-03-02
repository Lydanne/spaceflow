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

## 评分策略

支持两种评分策略，通过 `strategy` 配置切换：

| 策略               | 说明                                                      |
| ------------------ | --------------------------------------------------------- |
| `weighted`（默认） | 加权模式 — 根据代码量、PR 数、问题数等多维度加权计算      |
| `commit-based`     | 分数累计模式 — 按有效 commit 加分，按 error/warn 问题扣分 |

```json
{
  "review-summary": {
    "strategy": "weighted"
  }
}
```

### 策略一：加权模式（weighted）

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

**自定义权重**（通过 `scoreWeights` 配置，只需指定要修改的字段）：

```json
{
  "review-summary": {
    "strategy": "weighted",
    "scoreWeights": {
      "prBase": 15,
      "additionsPer100": 3,
      "deletionsPer100": 1.5,
      "changedFile": 1,
      "issueDeduction": 5,
      "fixedBonus": 2
    }
  }
}
```

| 配置项            | 类型   | 默认值 | 说明                    |
| ----------------- | ------ | ------ | ----------------------- |
| `prBase`          | number | 10     | 每个 PR 的基础分        |
| `additionsPer100` | number | 2      | 每 100 行新增代码的分数 |
| `deletionsPer100` | number | 1      | 每 100 行删除代码的分数 |
| `changedFile`     | number | 0.5    | 每个变更文件的分数      |
| `issueDeduction`  | number | 3      | 每个未修复问题的扣分    |
| `fixedBonus`      | number | 1      | 每个已修复问题的加分    |

### 策略二：分数累计模式（commit-based）

按每个 PR 中的有效 commit 和审查问题逐项计分，最终按人员汇总求和：

| 维度            | 权重          | 说明                                |
| --------------- | ------------- | ----------------------------------- |
| 有效 commit     | **+5** / 个   | 单个 commit 代码变更 ≥ 5 行视为有效 |
| error 问题      | **-2** / 个   | AI 审查发现的 error 级别问题        |
| warn 问题       | **-1** / 个   | AI 审查发现的 warn 级别问题         |
| 修复 error 问题 | **+1** / 个   | 修复一个 error，加对应扣分的一半    |
| 修复 warn 问题  | **+0.5** / 个 | 修复一个 warn，加对应扣分的一半     |

> **公式**: `分数 = 有效commit加分 - error扣分 - warn扣分 + 修复error加分 + 修复warn加分`（最低 0 分）

**有效 commit 判定**：

- 通过 API 逐个获取 commit 的文件变更信息
- 单个 commit 的 `additions + deletions ≥ minCommitLines`（默认 5 行）视为有效
- 自动跳过 merge commit

**修复数统计**：直接从 `@spaceflow/review` 模块嵌入在 PR 评论中的结构化审查数据中精确提取每个问题的 `severity` 和 `fixed` 状态，无需猜测。

**自定义权重**（通过 `commitBasedWeights` 配置）：

```json
{
  "review-summary": {
    "strategy": "commit-based",
    "commitBasedWeights": {
      "validCommit": 5,
      "errorDeduction": 2,
      "warnDeduction": 1,
      "errorFixedBonus": 1,
      "warnFixedBonus": 0.5,
      "minCommitLines": 5
    }
  }
}
```

| 配置项            | 类型   | 默认值 | 说明                                        |
| ----------------- | ------ | ------ | ------------------------------------------- |
| `validCommit`     | number | 5      | 每个有效 commit 的加分                      |
| `errorDeduction`  | number | 2      | 每个 error 问题的扣分                       |
| `warnDeduction`   | number | 1      | 每个 warn 问题的扣分                        |
| `errorFixedBonus` | number | 1      | 修复一个 error 问题的加分（默认扣分的一半） |
| `warnFixedBonus`  | number | 0.5    | 修复一个 warn 问题的加分（默认扣分的一半）  |
| `minCommitLines`  | number | 5      | 有效 commit 的最低代码行数（新增+删除）     |

> **注意**：commit-based 模式需要逐 commit 调用 API 获取行数信息，PR 较多时执行时间会较长。

## Issue 输出

当 `--output issue` 时，统计报告会创建为一个 Issue，并自动添加标签（默认 `report`）。标签名称可通过配置自定义：

```json
{
  "review-summary": {
    "issueLabel": "report"
  }
}
```

> **注意**：GitHub / GitLab 支持自动按名称匹配或创建标签；Gitea 需要提前在仓库中创建对应标签。

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

#### 加权模式（weighted）

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

#### 分数累计模式（commit-based）

以 alice 为例（12 个有效 commit, 1 个 error, 2 个 warn, 修复 1 个 error + 1 个 warn）：

```text
有效 commit:     12 × 5           = 60.0
error 扣分:      1 × 2            = -2.0
warn 扣分:       2 × 1            = -2.0
修复 error 加分: 1 × 1            = +1.0
修复 warn 加分:  1 × 0.5          = +0.5
─────────────────────────────────────
总分:            60 - 2 - 2 + 1 + 0.5 = 57.5
```

## 数据来源

统计数据通过 Git Provider API 获取：

| 数据        | 来源                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------- |
| PR 列表     | `listAllPullRequests` — 筛选时间范围内已合并的 PR                                               |
| 代码行数    | `getPullRequestFiles` — 统计每个文件的 additions/deletions                                      |
| 问题统计    | `listIssueComments` — 从 AI 审查评论中解析结构化数据，精确提取每个问题的 severity 和 fixed 状态 |
| 有效 commit | `getPullRequestCommits` + `getCommit` — 逐 commit 判断行数                                      |
| 功能描述    | PR 标题 — 自动去除 `[Tag]` 前缀                                                                 |

## 环境变量

| 变量                           | 说明                                                        |
| ------------------------------ | ----------------------------------------------------------- |
| `GITHUB_TOKEN` / `GITEA_TOKEN` | Git Provider API Token                                      |
| `GITHUB_REPOSITORY`            | 仓库名称（`owner/repo` 格式），也可通过 `--repository` 指定 |

## CI 集成

在 GitHub / Gitea Actions 中定期生成统计报告：

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
      - uses: Lydanne/spaceflow@main
        with:
          command: review-summary
          args: "-p last-week -o issue -c"
          provider-token: ${{ secrets.GITHUB_TOKEN }}
```
