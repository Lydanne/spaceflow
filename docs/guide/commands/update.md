# update — 更新依赖

更新已安装的 Extension 或 CLI 自身。

## 基本用法

```bash
# 更新所有已安装的 Extension
spaceflow update

# 更新指定 Extension
spaceflow update @spaceflow/review

# 更新 CLI 自身
spaceflow update --self
```

## 更新策略

| 类型 | 行为 |
|------|------|
| npm 包 | 获取最新版本并安装 |
| git 仓库 | 拉取最新代码 |
| `--self` | 更新 `spaceflow` CLI 到最新版本 |

## 命令行选项

| 选项 | 简写 | 说明 |
|------|------|------|
| `--self` | | 更新 CLI 自身 |
| `--verbose` | `-v` | 详细日志 |

## 示例

```bash
# 更新所有依赖
spaceflow update

# 仅更新 review Extension
spaceflow update @spaceflow/review

# 更新 spaceflow CLI
spaceflow update --self
```
