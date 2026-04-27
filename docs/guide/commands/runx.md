# runx — 运行命令

临时运行带 `bin` 的 npm CLI 包，类似于 `npx`。别名为 `x`。

::: warning 当前限制
`runx` 的 Extension 执行路径仍在迁移中。需要运行 Spaceflow Extension 时，请先使用 `spaceflow install <source>` 安装，再直接执行对应命令。
:::

## 基本用法

```bash
# 运行带 bin 的 npm 包
spaceflow x cowsay hello

# 使用完整命令名
spaceflow runx cowsay hello
```

## 工作流程

1. **解析 source** — npm 包会交给 `npx` 执行。
2. **透传参数** — 将剩余参数传给目标 CLI。

## 参数传递

使用 `--` 分隔 `runx` 自身的选项和传递给目标 CLI 的参数：

```bash
spaceflow x <source> [runx选项] -- [目标 CLI 参数]
```

示例：

```bash
# 传递 --help 给目标 CLI
spaceflow x cowsay -- --help

# 传递普通参数
spaceflow x cowsay -- hello
```

## 与 install 的区别

| 特性     | `install`              | `runx`            |
| -------- | ---------------------- | ----------------- |
| 目标     | Spaceflow Extension    | 带 bin 的 npm CLI |
| 持久化   | 写入 Spaceflow 配置    | 不修改配置        |
| 用途     | 长期使用的 Extension   | 临时运行工具      |

## 命令行选项

| 选项            | 简写 | 说明                  |
| --------------- | ---- | --------------------- |
| `--name <name>` | `-n` | 自定义 Extension 名称 |
| `--verbose`     | `-v` | 详细日志              |

## 示例

```bash
# 临时运行 npm CLI
spaceflow x cowsay -- hello
```
