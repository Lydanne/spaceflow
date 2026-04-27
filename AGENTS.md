# Spaceflow Agent 约定

## 交流

- 使用中文交流。
- 解释问题时先给结论，再给必要背景。
- 修改前先确认现有实现和文档约定，避免只按文件名猜测用途。

## 提交信息

- 使用 Conventional Commits：`type(scope): 中文主题`。
- `scope` 必须取本次变更文件最近的 `package.json` 所在目录名：
  - 根目录文件使用 `spaceflow`。
  - `packages/core/**` 使用 `core`。
  - `extensions/review/**` 使用 `review`。
  - `docs/**` 使用 `docs`。
- 一次提交跨多个 package 时，优先选择主要影响面；无法判断时使用 `spaceflow`。

## 文档分层

- `docs/guide`、`docs/reference` 放使用者关注的稳定文档。
- `docs/dev` 放开发者关注的实现、扩展开发、核心 API 和维护文档。
- `docs/spec` 放 AI 生成的临时方案、迁移计划、架构草稿；稳定后再迁入用户或开发者文档。
- 移动文档时同步更新 `docs/.vitepress/config.ts` 和站内链接。

## 代码与验证

- 包管理器使用 `pnpm`。
- 搜索文件和文本优先使用 `rg`。
- 修改 CLI 行为时同步检查对应命令文档。
- 逻辑修复优先补充或运行相关测试；无法运行时在交付说明中说明原因。

