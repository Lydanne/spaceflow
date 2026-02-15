# runx — 运行命令

全局安装并运行 Extension 命令，类似于 `npx`。别名为 `x`。

## 基本用法

```bash
# 运行指定 Extension 的命令
spaceflow x @spaceflow/review --help

# 运行本地路径的 Extension
spaceflow x ./extensions/ci-scripts -- --script ./deploy.sh

# 使用完整命令名
spaceflow runx @spaceflow/review -- -p 123
```

## 工作流程

1. **全局安装** — 如果 Extension 未全局安装，先执行全局安装
2. **运行命令** — 执行该 Extension 提供的命令，透传所有参数

## 参数传递

使用 `--` 分隔 `runx` 自身的选项和传递给 Extension 的参数：

```bash
spaceflow x <source> [runx选项] -- [Extension参数]
```

示例：

```bash
# 传递 --help 给 review 命令
spaceflow x @spaceflow/review -- --help

# 传递 -p 123 给 review 命令
spaceflow x @spaceflow/review -- -p 123

# 指定名称并传递参数
spaceflow x ./extensions/ci-scripts -n ci-scripts -- --script ./test.sh
```

## 与 install 的区别

| 特性     | `install`             | `runx`     |
| -------- | --------------------- | ---------- |
| 安装位置 | 本地项目（默认）      | 全局       |
| 持久化   | 写入 `spaceflow.json` | 不修改配置 |
| 用途     | 长期使用的 Extension  | 临时运行   |

## 命令行选项

| 选项            | 简写 | 说明                  |
| --------------- | ---- | --------------------- |
| `--name <name>` | `-n` | 自定义 Extension 名称 |
| `--verbose`     | `-v` | 详细日志              |

## 示例

```bash
# 临时运行 review
spaceflow x @spaceflow/review -- -p 42

# 临时运行本地 Extension
spaceflow x ./extensions/my-tool -- --config custom.json
```
