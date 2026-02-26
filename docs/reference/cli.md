# CLI 命令参考

所有 Spaceflow CLI 命令的完整参考。命令通过 `spaceflow` 或简写 `space` 调用。

## 全局选项

| 选项        | 简写 | 说明                                                   |
| ----------- | ---- | ------------------------------------------------------ |
| `--help`    | `-h` | 显示帮助信息                                           |
| `--version` | `-V` | 显示版本号                                             |
| `--verbose` | `-v` | 详细日志（可叠加：`-v` 基本，`-vv` 详细，`-vvv` 调试） |

## 内置命令

以下命令内置于 `@spaceflow/core`，无需安装即可使用。

### `install`

安装 Extension。别名 `i`。

```bash
spaceflow install [source]         # 安装指定 Extension
spaceflow install                  # 安装配置文件中所有 dependencies
spaceflow install <source> -g      # 全局安装
spaceflow install <source> -n name # 指定安装名称
spaceflow install <source> -r tag  # 指定版本/分支/tag
```

### `uninstall`

卸载 Extension。

```bash
spaceflow uninstall <name>         # 本地卸载
spaceflow uninstall <name> -g      # 全局卸载
```

### `update`

更新已安装的 Extension。

```bash
spaceflow update                   # 更新所有
spaceflow update <name>            # 更新指定 Extension
spaceflow update --self            # 更新 CLI 自身
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
spaceflow build <name>             # 构建指定 Extension
spaceflow build --watch            # 监听模式
```

### `dev`

开发模式，等价于 `build --watch`。

```bash
spaceflow dev                      # 监听并构建所有
spaceflow dev <name>               # 监听并构建指定 Extension
```

### `create`

基于模板创建新的 Extension 项目。

```bash
spaceflow create command <name>    # 创建命令型 Extension
spaceflow create mcp <name>        # 创建 MCP Server Extension
spaceflow create skills <name>     # 创建技能型 Extension
spaceflow create --list            # 查看可用模板
spaceflow create --from <repo> command <name>  # 使用远程模板
```

### `commit`

AI 智能提交，基于 Conventional Commits 规范自动生成 commit message。

```bash
spaceflow commit                   # 自动生成 commit message
spaceflow commit --split           # 智能拆分为多个 commit
spaceflow commit --scope <scope>   # 指定 scope
```

### `setup`

初始化 Spaceflow 项目配置。

```bash
spaceflow setup                    # 本地初始化
spaceflow setup -g                 # 全局初始化
```

### `schema`

生成配置文件的 JSON Schema。

```bash
spaceflow schema
```

### `mcp`

启动 MCP（Model Context Protocol）服务器。

```bash
spaceflow mcp                      # 启动 MCP Server
spaceflow mcp --inspector          # 启动 MCP Inspector 调试模式
```

### `runx`

全局安装并运行 Extension 命令。别名 `x`。

```bash
spaceflow x <source> -- <args>     # 运行并透传参数
spaceflow runx <source> -n name -- <args>
```

### `clear`

清理缓存、依赖和编辑器关联文件。

```bash
spaceflow clear                    # 清理本地
spaceflow clear -g                 # 清理全局
```

## 扩展命令

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
