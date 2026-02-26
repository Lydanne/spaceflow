# create — 创建模板

基于模板创建新的 Extension 项目。支持本地模板和远程 Git 仓库模板。

## 基本用法

```bash
# 创建命令型 Extension
spaceflow create command my-cmd

# 创建技能型 Extension
spaceflow create skills my-skill

# 查看可用模板
spaceflow create --list

# 指定输出目录
spaceflow create command my-cmd -d ./plugins/my-cmd

# 使用远程模板仓库
spaceflow create --from https://github.com/user/templates command my-cmd

# 使用远程模板仓库的指定分支/标签
spaceflow create --from git@github.com:org/tpl.git --ref v1.0 api my-api
```

## 模板类型

模板动态读取自项目的 `templates/` 目录。内置模板包括：

| 模板      | 说明                                     |
| --------- | ---------------------------------------- |
| `command` | 命令型 Extension，提供 CLI 命令          |
| `mcp`     | MCP Server 型 Extension                  |
| `skills`  | 技能型 Extension，提供编辑器 AI 技能文件 |

## 远程模板

使用 `--from` 指定远程 Git 仓库作为模板来源：

```bash
# GitHub 仓库
spaceflow create --from https://github.com/user/templates command my-cmd

# Gitea 仓库
spaceflow create --from https://git.example.com/org/templates command my-cmd

# SSH + 指定 ref
spaceflow create --from git@github.com:org/tpl.git --ref v1.0 api my-api
```

远程模板会被下载到本地缓存，后续使用时优先使用缓存。

## 生成的文件结构

以 `command` 模板为例：

```text
my-cmd/
├── src/
│   └── index.ts               # Extension 入口（defineExtension）
├── package.json
├── tsconfig.json
└── README.md
```

## 命令行选项

| 选项                | 简写 | 说明                       |
| ------------------- | ---- | -------------------------- |
| `--directory <dir>` | `-d` | 指定输出目录               |
| `--list`            | `-l` | 列出可用模板               |
| `--from <repo>`     | `-f` | 远程模板仓库 URL           |
| `--ref <ref>`       | `-r` | 远程仓库的分支/标签/commit |
| `--verbose`         | `-v` | 详细日志                   |

## 示例

```bash
# 查看所有可用模板
spaceflow create --list

# 查看远程仓库的可用模板
spaceflow create --from https://github.com/org/templates --list

# 创建并指定目录
spaceflow create command my-review -d ./extensions/my-review
```
