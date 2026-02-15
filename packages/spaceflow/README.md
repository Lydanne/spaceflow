# spaceflow

[![npm](https://img.shields.io/npm/v/spaceflow)](https://www.npmjs.com/package/spaceflow)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

可扩展的 AI 工程化工作流平台，提供插件化的 CI/CD 管理、AI 代码审查和多编辑器集成能力。

> 这是 [`@spaceflow/cli`](https://www.npmjs.com/package/@spaceflow/cli) 的便捷包装包，提供 `spaceflow` / `space` 全局命令。

## 安装

```bash
# 全局安装
npm install -g spaceflow

# 或作为项目开发依赖
pnpm add -D spaceflow
```

## 使用

```bash
spaceflow <command> [options]
space <command> [options]
```

## 常用命令

```bash
# 初始化项目配置
spaceflow setup

# 安装插件
spaceflow install @spaceflow/review
spaceflow install @spaceflow/publish

# AI 代码审查
spaceflow review -p 123 -l openai

# 自动化发布
spaceflow publish --ci

# AI 智能提交
spaceflow commit

# 查看所有命令
spaceflow --help
```

## 与 @spaceflow/cli 的关系

`spaceflow` 包是 `@spaceflow/cli` 的代理包，功能完全一致。区别仅在于包名：

- **`spaceflow`** — 更简短的包名，适合全局安装（`npm i -g spaceflow`）
- **`@spaceflow/cli`** — 带 scope 的包名，适合作为项目依赖

## 文档

完整文档请参考 [GitHub 仓库](https://github.com/Lydanne/spaceflow)。

## 许可证

[MIT](../../LICENSE)
