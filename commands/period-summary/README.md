# @spaceflow/period-summary

Spaceflow 周期统计命令，根据时间范围统计 PR 贡献情况，按人员汇总并排序。

## 功能特性

- **时间范围统计**：支持自定义日期范围或预设时间段
- **多维度统计**：PR 数量、代码行数、变更文件数、问题数量
- **综合评分**：根据代码量和问题数量权衡计算分数
- **按人员排序**：按综合分数降序排列贡献者
- **多种输出方式**：控制台、GitHub Issue、Markdown 文件

## 使用方法

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
