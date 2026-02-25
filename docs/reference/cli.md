# CLI 命令参考

所有 Spaceflow CLI 命令的完整参考。

## 全局选项

| 选项        | 简写 | 说明                                      |
| ----------- | ---- | ----------------------------------------- |
| `--help`    | `-h` | 显示帮助信息                              |
| `--version` | `-V` | 显示版本号                                |
| `--verbose` | `-v` | 详细日志（`-v` 基本日志，`-vv` 详细日志） |
| `--dry-run` |      | 试运行，不实际执行                        |
| `--ci`      |      | CI 模式                                   |

## 内置命令

### `install`

安装 Extension。

```bash
spaceflow install <package>        # 安装指定 Extension
spaceflow install                  # 安装 spaceflow.json 中所有 dependencies
spaceflow install <package> -g     # 全局安装
```

### `uninstall`

卸载 Extension。

```bash
spaceflow uninstall <name>
```

### `update`

更新已安装的 Extension。

```bash
spaceflow update                   # 更新所有
spaceflow update <name>            # 更新指定 Extension
```

### `list`

列出已安装的 Extension。

```bash
spaceflow list
```

输出示例：

```text
已安装的 Extension:

  review        @spaceflow/review          [link]
    命令: review

  publish       @spaceflow/publish         [link]
    命令: publish
```

### `build`

构建 Extension。

```bash
spaceflow build                    # 构建所有
spaceflow build --watch            # 监听模式
spaceflow build <name>             # 构建指定 Extension
```

### `dev`

开发模式，监听文件变化并自动重新构建。

```bash
spaceflow dev
spaceflow dev <name>
```

### `create`

创建新的 Extension 模板。

```bash
spaceflow create <name>            # 创建命令型 Extension
spaceflow create <name> --skill    # 创建技能型 Extension
```

### `commit`

Git 提交辅助，基于 Conventional Commits 规范。

```bash
spaceflow commit
```

### `setup`

同步编辑器配置。

```bash
spaceflow setup                    # 同步所有已配置编辑器
```

### `schema`

生成 `spaceflow.json` 的 JSON Schema。

```bash
spaceflow schema
```

### `mcp`

启动 MCP（Model Context Protocol）服务。

```bash
spaceflow mcp
```

### `runx`

运行外部命令，透传参数。

```bash
spaceflow runx <source> -- <args>
# 简写
spaceflow x <source> -- <args>
```

### `clear`

清理缓存和临时文件。

```bash
spaceflow clear
```

## 外部命令

以下命令需要先安装对应的 Extension。

### `review`

AI 代码审查。详见 [review 命令](/guide/commands/review)。

```bash
spaceflow review -p <pr-number> [-l <llm-mode>]
spaceflow review -b <base> --head <head> [-l <llm-mode>]
```

### `publish`

版本发布。详见 [publish 命令](/guide/commands/publish)。

```bash
spaceflow publish [--dry-run]
```

### `scripts`

脚本执行。详见 [scripts 命令](/guide/commands/scripts)。

```bash
spaceflow scripts --script <path>
```

### `shell`

Shell 执行。详见 [shell 命令](/guide/commands/shell)。

```bash
spaceflow shell --command <cmd>
```

### `review-summary`

审查总结。详见 [review-summary 命令](/guide/commands/review-summary)。

```bash
spaceflow review-summary --period <week|month>
```
