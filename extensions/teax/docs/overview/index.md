# Teax Overview 文档导航

> 本目录用于承载 Teax 的高层设计与 Agents 方案说明。  
> 目录约束：`docs/overview/` 仅保留一级文件，不再使用子目录。

## 建议阅读顺序

1. [平台架构总览](./architecture.md)
2. [Agents 系统设计](./agents-design.md)
3. [Agents Runtime 配置与使用](./agents-runtime.md)

## Overview 目录文件

- `architecture.md`
  - 平台定位、用户体系、功能模块、技术栈
- `agents-design.md`
  - 当前 Agents 已实现模型（Runtime/Session/协作/权限）
- `agents-runtime.md`
  - 当前 P1 已落地运行手册（Docker Runtime + Session 目录生命周期）

## 关联文档（位于 `docs/` 根目录）

- [API 规范](../api-specification.md)
- [权限系统](../permission-system.md)
- [CI/CD 集成](../cicd-integration.md)
- [Agents 当前实现文档](../agent-system.md)
- [数据库设计](../database-design.md)
- [部署配置](../deployment.md)
- [飞书集成](../feishu-integration.md)
- [飞书卡片交互](../feishu-card-interaction.md)
- [开发计划](../plan.md)

## 本次整理说明

- 已将旧入口与旧路径合并到 `docs/overview/`：
  - `docs/overview.md` -> `docs/overview/architecture.md`
  - `docs/design.md` -> `docs/overview/index.md`
  - `docs/agents.md` -> `docs/overview/agents-design.md`
  - `docs/overview/agents/runtime.md` -> `docs/overview/agents-runtime.md`
- 已移除 `docs/overview/agents/` 子目录，保持 overview 单层结构。
