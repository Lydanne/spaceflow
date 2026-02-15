# install — 安装 Extension

安装外部 Extension 到当前项目或全局环境。

## 基本用法

```bash
# 安装指定 Extension（npm 包）
spaceflow install @spaceflow/review

# 安装本地路径
spaceflow install ./extensions/my-plugin

# 安装 git 仓库
spaceflow install git@github.com:org/plugin.git

# 安装所有 spaceflow.json 中的 dependencies
spaceflow install

# 全局安装
spaceflow install @spaceflow/review -g
```

## 支持的 source 类型

| 类型     | 示例                            | 说明                                 |
| -------- | ------------------------------- | ------------------------------------ |
| npm 包   | `@spaceflow/review`             | 执行 `pnpm add <package>`            |
| 本地路径 | `./extensions/my-plugin`        | 注册 `link:` 引用到 `spaceflow.json` |
| git 仓库 | `git@github.com:org/plugin.git` | 克隆到 `.spaceflow/deps/`            |

## 安装流程

1. **解析 source** — 判断是 npm 包、本地路径还是 git 仓库
2. **安装依赖** — 根据类型执行对应的安装操作
3. **更新配置** — 将 Extension 注册到 `spaceflow.json` 的 `dependencies` 字段
4. **关联编辑器** — 将 Extension 的 skills 关联到 `support` 中配置的编辑器目录

## 无参数模式

不传 source 时，会读取 `spaceflow.json` 中的 `dependencies` 字段，安装所有已注册的 Extension：

```bash
spaceflow install
```

等价于遍历 `dependencies` 中的每一项并逐个安装。

## 全局安装

使用 `-g` 标志安装到全局目录 `~/.spaceflow/`：

```bash
spaceflow install @spaceflow/review -g
```

全局安装的 Extension 在所有项目中可用。

## 命令行选项

| 选项              | 简写 | 说明                  |
| ----------------- | ---- | --------------------- |
| `--name <name>`   | `-n` | 自定义 Extension 名称 |
| `--global`        | `-g` | 全局安装              |
| `--verbose`       | `-v` | 详细日志              |
| `--ignore-errors` |      | 忽略错误，不退出进程  |

## 示例

```bash
# 安装并指定名称
spaceflow install @spaceflow/review --name review

# 安装本地开发中的 Extension
spaceflow install ./extensions/review

# CI 中安装所有依赖（忽略错误）
spaceflow install --ignore-errors
```
