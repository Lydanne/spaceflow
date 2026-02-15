# period-summary — 周期总结

`period-summary` 命令用于生成周期性工作总结，支持飞书消息推送。

## 安装

```bash
spaceflow install @spaceflow/period-summary
```

## 基本用法

```bash
# 生成周总结
spaceflow period-summary --period week

# 生成月总结
spaceflow period-summary --period month

# 推送到飞书
spaceflow period-summary --period week --notify feishu
```

## 功能特性

- **Git 日志分析** — 自动分析指定周期内的 Git 提交记录
- **AI 总结** — 使用 LLM 生成结构化的工作总结
- **飞书推送** — 支持将总结推送到飞书群聊

## 命令行选项

| 选项 | 说明 |
|------|------|
| `--period <period>` | 总结周期（week / month） |
| `--notify <channel>` | 通知渠道（feishu） |
| `--dry-run` | 试运行 |
| `--verbose` | 详细日志 |
