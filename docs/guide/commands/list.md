# list — 列出 Extension

列出当前项目中已安装的所有 Extension 及其信息。

## 基本用法

```bash
spaceflow list
```

## 输出示例

```text
已安装的 Extension:

  review        @spaceflow/review          [link]
    命令: review

  publish       @spaceflow/publish         [link]
    命令: publish

  shell         @spaceflow/shell           [npm]
    命令: shell
```

输出包含：

- **Extension 名称** — 注册名
- **包名** — npm 包名或路径
- **安装类型** — `[link]`（本地路径）、`[npm]`（npm 包）、`[git]`（git 仓库）
- **提供的命令** — 该 Extension 注册的 CLI 命令

## 命令行选项

| 选项        | 简写 | 说明             |
| ----------- | ---- | ---------------- |
| `--verbose` | `-v` | 显示更多详细信息 |
