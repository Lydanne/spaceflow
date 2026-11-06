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

# 在 monorepo 中预览单包的精确版本
spaceflow publish --target @spaceflow/core@5.2.7 --dry-run
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
| `--target <package@version>` | 仅发布指定工作区包，版本须为更高的精确稳定版本 |
| `--verbose` | 详细日志 |
| `--ci` | CI 模式 |

本仓库推送到 `main` 默认自动发布变更包及其依赖方。只发布一个包时，在推送的最后一条提交信息中加入 `[skip ci]`，然后手动运行 GitHub Actions 的 Publish 工作流，填写 `target`。先勾选 `dry_run` 核对包名和版本，再用相同目标正式运行。
