# ci-scripts — 脚本执行

`ci-scripts` 命令用于在 CI 环境中执行仓库中的自定义脚本。

## 安装

```bash
spaceflow install @spaceflow/ci-scripts
```

## 基本用法

```bash
# 执行指定脚本
spaceflow ci-scripts --script ./scripts/deploy.sh

# CI 模式
spaceflow ci-scripts --script ./scripts/test.sh --ci
```

## 使用场景

- 在 PR 合并后执行部署脚本
- 在 CI 中运行自定义检查脚本
- 批量执行仓库中的自动化任务

## 命令行选项

| 选项 | 说明 |
|------|------|
| `--script <path>` | 脚本文件路径 |
| `--ci` | CI 模式 |
| `--dry-run` | 试运行 |
| `--verbose` | 详细日志 |
