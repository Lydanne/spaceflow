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

## 文件过滤

统计代码行数和变更文件时，支持通过 glob 模式过滤文件，排除测试、配置等非业务代码：

```json
{
  "review-summary": {
    "includes": ["*/**/*.ts", "!*/**/*.spec.*", "!*/**/*.config.*"]
  }
}
```

- 支持 `!` 排除模式（如 `!*/**/*.spec.*` 排除测试文件）
- 使用 [micromatch](https://github.com/micromatch/micromatch) 语法，`matchBase` 模式
- **未配置时自动 fallback 读取 `review.includes`**，与代码审查使用相同的过滤规则
- 过滤同时影响 `additions`、`deletions` 和 `changedFiles` 统计

## 评分策略

支持四种评分策略，通过 `strategy` 配置切换：

| 策略               | 说明                                                                 |
| ------------------ | -------------------------------------------------------------------- |
| `weighted`（默认） | 加权模式 — 根据代码量、PR 数、问题数等多维度加权计算                 |
| `issue-based`      | 审查质量模式 — 逐 PR 计算基础分(对数缩放 60-100) + 问题扣分/修复加分 |
| `defect-rate`      | 缺陷率模式 — 基于每百行代码的问题密度计算违规率，代码量大时容错更高  |
| `commit-based`     | 分数累计模式 — 按有效 commit 加分，按 error/warn 问题扣分            |

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

### 策略二：审查质量模式（issue-based）

逐 PR 计算分数，每个 PR 的基础分根据代码量对数缩放到 60-100 区间，再按审查问题扣分和修复加分，最终汇总求和：

| 维度            | 权重        | 说明                                                   |
| --------------- | ----------- | ------------------------------------------------------ |
| PR 基础分       | **60-100**  | 根据代码量对数缩放，防止刷行数，小 PR 也有不错的基础分 |
| error 问题      | **-8** / 个 | AI 审查发现的 error 级别问题                           |
| warn 问题       | **-3** / 个 | AI 审查发现的 warn 级别问题                            |
| 修复 error 问题 | **+5** / 个 | 修复一个 error，弥补扣分的 ~63%                        |
| 修复 warn 问题  | **+2** / 个 | 修复一个 warn，弥补扣分的 ~67%                         |

> **公式**: `PR分数 = PR基础分(60-100) - error扣分 - warn扣分 + 修复error加分 + 修复warn加分`（每个 PR 最低 0 分）
>
> **用户总分**: `Σ 所有 PR 分数`

**PR 基础分计算**：

使用对数缩放将代码量（additions + deletions）映射到 [minBase, maxBase] 区间：

```text
基础分 = minBase + (maxBase - minBase) × min(1, log₂(1 + 代码行数) / log₂(1 + capLines))
```

| 代码行数 | 基础分（约） |
| -------- | ------------ |
| 0 行     | 60           |
| 30 行    | 80           |
| 100 行   | 87           |
| 300 行   | 93           |
| 1000+ 行 | 100          |

**自定义权重**（通过 `issueBasedWeights` 配置）：

```json
{
  "review-summary": {
    "strategy": "issue-based",
    "issueBasedWeights": {
      "minBase": 60,
      "maxBase": 100,
      "capLines": 1000,
      "errorDeduction": 8,
      "warnDeduction": 3,
      "errorFixedBonus": 5,
      "warnFixedBonus": 2
    }
  }
}
```

| 配置项            | 类型   | 默认值 | 说明                                     |
| ----------------- | ------ | ------ | ---------------------------------------- |
| `minBase`         | number | 60     | PR 基础分下限                            |
| `maxBase`         | number | 100    | PR 基础分上限                            |
| `capLines`        | number | 1000   | 代码量封顶行数，超过此值基础分为 maxBase |
| `errorDeduction`  | number | 8      | 每个 error 问题的扣分                    |
| `warnDeduction`   | number | 3      | 每个 warn 问题的扣分                     |
| `errorFixedBonus` | number | 5      | 修复一个 error 问题的加分                |
| `warnFixedBonus`  | number | 2      | 修复一个 warn 问题的加分                 |

### 策略三：缺陷率模式（defect-rate）

基于**每百行代码的问题密度**计算缺陷率（0-100%），代码量大时同等问题数影响更小，体现"单位代码内坏代码的比例"：

**核心公式**：

```text
PR问题密度 = (error × errorPenalty + warn × warnPenalty) / max(1, 代码行数 / 100)
PR合规度 = clamp(1 - 问题密度 + 修复恢复, 0, 1)
用户缺陷率 = (1 - 所有PR合规度的平均值) × 100%
```

**代码量对问题密度的影响**：

| PR  | 代码量 | 问题              | 每百行密度 | 合规度   |
| --- | ------ | ----------------- | ---------- | -------- |
| #1  | 1000行 | 2 error           | 0.06       | **0.94** |
| #2  | 200行  | 2 error           | 0.30       | **0.70** |
| #3  | 50行   | 2 error           | 1.20       | **0.00** |
| #4  | 500行  | 1 error（已修复） | 0.06       | **0.99** |

> 同样 2 个 error，1000 行代码只有 6% 缺陷率，50 行代码直接 100% — 代码量越大容错越高。

**修复恢复**：修复一个问题恢复 0.05 合规度（权重很小），体现"问题本不应发生"的态度，但积极修复仍有少量弥补。

**排序**：按缺陷率**升序**排列（缺陷率越低越靠前）。

**自定义权重**（通过 `defectRateWeights` 配置）：

```json
{
  "review-summary": {
    "strategy": "defect-rate",
    "defectRateWeights": {
      "errorPenalty": 0.3,
      "warnPenalty": 0.1,
      "fixedDiscount": 0.05
    }
  }
}
```

| 配置项          | 类型   | 默认值 | 说明                                          |
| --------------- | ------ | ------ | --------------------------------------------- |
| `errorPenalty`  | number | 0.3    | 每百行代码 1 个 error 降低的合规度            |
| `warnPenalty`   | number | 0.1    | 每百行代码 1 个 warn 降低的合规度             |
| `fixedDiscount` | number | 0.05   | 修复 1 个问题恢复的合规度（权重很小，可调大） |

### 策略四：分数累计模式（commit-based）

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

#### 审查质量模式（issue-based）

以 alice 为例（3 个 PR）：

```text
PR #142: 970 行代码, 2 error, 0 warn, 修复 1 error
  基础分:          60 + 40 × min(1, log₂(971) / log₂(1001)) = 99.7
  error 扣分:      2 × 8            = -16.0
  修复 error 加分: 1 × 5            = +5.0
  PR 分数:         99.7 - 16 + 5    = 88.7

PR #145: 200 行代码, 0 error, 1 warn, 修复 1 warn
  基础分:          60 + 40 × min(1, log₂(201) / log₂(1001)) = 90.6
  warn 扣分:       1 × 3            = -3.0
  修复 warn 加分:  1 × 2            = +2.0
  PR 分数:         90.6 - 3 + 2     = 89.6

PR #148: 80 行代码, 0 error, 0 warn
  基础分:          60 + 40 × min(1, log₂(81) / log₂(1001)) = 85.4
  PR 分数:         85.4

─────────────────────────────────────
总分:              88.7 + 89.6 + 85.4 = 263.7
```

#### 缺陷率模式（defect-rate）

以 alice 为例（3 个 PR）：

```text
PR #142: 970 行代码, 2 error, 0 warn, 修复 1 error
  每百行密度:  (2 × 0.3 + 0 × 0.1) / (970/100) = 0.062
  修复恢复:    1 × 0.05                          = 0.05
  合规度:      clamp(1 - 0.062 + 0.05, 0, 1)     = 0.988

PR #145: 200 行代码, 0 error, 1 warn, 修复 1 warn
  每百行密度:  (0 × 0.3 + 1 × 0.1) / (200/100) = 0.050
  修复恢复:    1 × 0.05                          = 0.05
  合规度:      clamp(1 - 0.05 + 0.05, 0, 1)      = 1.000

PR #148: 80 行代码, 1 error, 0 warn, 未修复
  每百行密度:  (1 × 0.3 + 0 × 0.1) / (80/100)  = 0.375
  修复恢复:    0
  合规度:      clamp(1 - 0.375, 0, 1)             = 0.625

─────────────────────────────────────
平均合规度:    (0.988 + 1.000 + 0.625) / 3 = 0.871
缺陷率:        (1 - 0.871) × 100% = 12.9%
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
          args: "-p last-week -o issue"
          provider-token: ${{ secrets.GITHUB_TOKEN }}
```
