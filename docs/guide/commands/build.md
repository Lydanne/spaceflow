# build — 构建

构建 Extension 包，将 TypeScript 源码编译为可发布的 JavaScript。

## 基本用法

```bash
# 构建所有 Extension
spaceflow build

# 构建指定 Extension
spaceflow build review

# 监听模式（文件变化时自动重新构建）
spaceflow build --watch
```

## 构建流程

1. **扫描 Extension** — 查找 `extensions/` 目录下的所有 Extension 包
2. **读取配置** — 读取每个包的 `rspack.config.mjs` 或默认配置
3. **编译打包** — 使用 Rspack 将 TypeScript 编译为单文件 JavaScript
4. **输出结果** — 生成到各包的 `dist/` 目录

## 监听模式

使用 `--watch` 或 `dev` 命令进入监听模式，文件变化时自动重新构建：

```bash
spaceflow build --watch
# 等价于
spaceflow dev
```

## 命令行选项

| 选项        | 简写 | 说明                           |
| ----------- | ---- | ------------------------------ |
| `--watch`   | `-w` | 监听模式，文件变化自动重新构建 |
| `--verbose` | `-v` | 详细日志                       |

## 退出码

| 退出码 | 含义                        |
| ------ | --------------------------- |
| `0`    | 所有 Extension 构建成功     |
| `1`    | 至少一个 Extension 构建失败 |
