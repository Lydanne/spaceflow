---
layout: home

hero:
  name: Spaceflow
  text: 可扩展的 AI 工作流引擎
  tagline: 统一 CI/CD 管理、AI 代码审查、多编辑器插件分发
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 查看 GitHub
      link: https://github.com/Lydanne/spaceflow

features:
  - icon: 🤖
    title: AI 代码审查
    details: 基于 LLM 的自动化代码审查，支持 OpenAI、Claude 等多种模型，自动生成行内评论和 PR 描述。
  - icon: 🔌
    title: Extension 插件系统
    details: 命令以 Extension 形式分发，支持 npm 包和本地链接，通过 spaceflow.json 统一管理。
  - icon: 🛠️
    title: 丰富的内置命令
    details: 提供 install、build、dev、commit、review、publish 等开箱即用的命令。
  - icon: 🖥️
    title: 多编辑器集成
    details: 一键将技能和命令关联到 Claude Code、Windsurf、Cursor、OpenCode 等 AI 编程工具。
  - icon: 📦
    title: CI/CD 自动化
    details: 预配置 GitHub Actions 工作流，支持自动 PR 审查、版本发布、自定义脚本执行。
  - icon: 🌐
    title: 国际化支持
    details: 基于 i18next 的完整 i18n 方案，每个 Extension 自管理翻译资源，默认中文。
---
