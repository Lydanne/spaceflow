# scripts — 脚本执行

`scripts` 命令用于在 CI 环境中执行一段 JavaScript 语句，并在执行前后锁定/解锁当前分支。

## 安装

```bash
spaceflow install @spaceflow/scripts
```

## 基本用法

```bash
# 执行指定 JavaScript 语句
spaceflow scripts "console.log('deploy')"

# CI 模式
spaceflow scripts "await import('./scripts/deploy.js')" --dry-run
```

## 使用场景

- 在 PR 合并后执行部署逻辑
- 在 CI 中运行自定义检查脚本
- 批量执行仓库中的自动化任务

## 命令行选项

| 选项        | 说明         |
| ----------- | ------------ |
| `--dry-run` | 跳过脚本执行 |
