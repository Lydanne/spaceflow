# clear — 清理缓存

清理所有已安装的 Extension 依赖和编辑器关联文件。

## 基本用法

```bash
# 清理本地安装的所有内容
spaceflow clear

# 清理全局安装的所有内容
spaceflow clear -g
```

## 清理范围

执行以下清理操作：

1. **删除依赖目录** — 清空 `.spaceflow/deps/` 下的所有已安装依赖
2. **清理编辑器 skills** — 删除各编辑器配置目录下的 skills 关联文件
3. **清理编辑器 commands** — 删除各编辑器配置目录下生成的 `.md` 命令文件

### 影响的目录

| 目录 | 说明 |
|------|------|
| `.spaceflow/deps/` | 本地依赖安装目录 |
| `.claude/skills/` | Claude Code 技能文件 |
| `.windsurf/skills/` | Windsurf 技能文件 |
| `.cursor/skills/` | Cursor 技能文件 |

::: warning
清理操作不可撤销。清理后需要重新运行 `spaceflow install` 恢复依赖。
:::

## 全局清理

使用 `-g` 清理全局目录 `~/.spaceflow/`：

```bash
spaceflow clear -g
```

## 命令行选项

| 选项 | 简写 | 说明 |
|------|------|------|
| `--global` | `-g` | 清理全局安装 |
| `--verbose` | `-v` | 详细日志 |

## 使用场景

- Extension 安装出现异常，需要重新安装
- 切换项目配置后，清理旧的关联文件
- 排查问题时，从干净状态重新开始
