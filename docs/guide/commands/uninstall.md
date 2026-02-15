# uninstall — 卸载 Extension

从当前项目或全局环境中卸载已安装的 Extension。

## 基本用法

```bash
# 卸载指定 Extension
spaceflow uninstall @spaceflow/review

# 全局卸载
spaceflow uninstall @spaceflow/review -g
```

## 卸载流程

1. **移除依赖** — npm 包执行 `pnpm remove`；git 仓库执行 `git submodule deinit` 并删除目录
2. **更新配置** — 从 `spaceflow.json` 的 `dependencies` 中移除
3. **清理关联** — 移除编辑器目录中的关联文件

## 命令行选项

| 选项 | 简写 | 说明 |
|------|------|------|
| `--global` | `-g` | 卸载全局安装的 Extension |
| `--verbose` | `-v` | 详细日志 |

## 示例

```bash
# 卸载本地 Extension
spaceflow uninstall @spaceflow/review

# 卸载全局 Extension
spaceflow uninstall @spaceflow/review -g
```
