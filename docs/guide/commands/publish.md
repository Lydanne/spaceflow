# publish — 版本发布

`publish` 命令提供自动化版本发布能力，基于 [release-it](https://github.com/release-it/release-it) 实现版本管理和变更日志生成。

## 安装

```bash
spaceflow install @spaceflow/publish
```

## 基本用法

```bash
# 发布版本
spaceflow publish

# 试运行
spaceflow publish --dry-run

# 指定版本号
spaceflow publish --version 1.2.0
```

## 功能特性

- **自动版本号** — 基于 Conventional Commits 自动计算版本号
- **变更日志** — 自动生成 CHANGELOG.md
- **Monorepo 支持** — 支持 pnpm workspace 的多包发布
- **npm 发布** — 自动发布到 npm registry
- **Git 标签** — 自动创建 Git tag 并推送

## 配置

```json
{
  "publish": {
    "monorepo": {
      "enabled": true,
      "propagateDeps": true
    },
    "changelog": {
      "preset": {
        "type": [
          { "type": "feat", "section": "新特性" },
          { "type": "fix", "section": "修复BUG" },
          { "type": "perf", "section": "性能优化" },
          { "type": "refactor", "section": "代码重构" }
        ]
      }
    },
    "npm": {
      "publish": true,
      "packageManager": "pnpm",
      "tag": "latest"
    },
    "git": {
      "pushWhitelistUsernames": ["github-actions[bot]"]
    }
  }
}
```

## 命令行选项

| 选项 | 说明 |
|------|------|
| `--dry-run` | 试运行，不实际发布 |
| `--version <version>` | 指定版本号 |
| `--verbose` | 详细日志 |
| `--ci` | CI 模式 |
