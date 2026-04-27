---
name: docs-maintenance
description: Maintain the Spaceflow documentation structure and VitePress navigation.
---
# docs-maintenance

更新 Spaceflow 文档、导航或文档目录时使用。

## 分层

- `docs/guide` 和 `docs/reference`：使用者关注的稳定文档。
- `docs/dev`：开发者关注的扩展开发、核心 API、实现维护文档。
- `docs/spec`：AI 生成的临时方案、迁移计划、架构草稿；稳定后迁入其它目录。

## 修改步骤

1. 先判断读者：使用者、开发者、还是临时方案。
2. 移动或新增文档后，同步更新 `docs/.vitepress/config.ts`。
3. 用 `rg` 检查旧链接，例如 `/advanced/`、`/design/`、移动前的文件名。
4. 命令文档必须和 `defineExtension` 中的命令名、参数、选项保持一致。
5. 文档示例优先使用当前默认值，例如 `support: ["agents"]`。

