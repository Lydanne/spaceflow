# commit — 智能提交

基于 AI 自动生成符合 [Conventional Commits](https://www.conventionalcommits.org/) 规范的 commit message，并执行 `git commit`。

## 基本用法

```bash
# 自动生成 commit message 并提交
spaceflow commit

# 试运行，仅生成不提交
spaceflow commit --dry-run

# 智能拆分提交（按模块/功能自动拆分为多个 commit）
spaceflow commit --split

# 跳过 git hooks
spaceflow commit --no-verify
```

## 工作流程

### 普通模式

1. **检查暂存区** — 确认有 `git add` 过的文件
2. **获取上下文** — 读取暂存文件列表、diff、所属包信息、最近 commit 历史
3. **构建 Prompt** — 将上下文和 Conventional Commits 类型规范发送给 LLM
4. **解析响应** — 从 AI 响应中提取 `type`、`scope`、`subject`、`body`
5. **执行提交** — 格式化为 `type(scope): subject` 并执行 `git commit`

### Split 模式（`--split`）

1. **收集文件** — 获取暂存区或工作区的所有变更文件
2. **分组策略** — 根据配置的 scope 策略对文件分组：
   - `package` — 按 `package.json` 所属包分组（默认）
   - `rules` — 按自定义 glob 规则分组
   - `rules-first` — 优先规则匹配，未匹配的按包分组
3. **AI 分析** — 单组时让 AI 进一步分析是否需要拆分
4. **并行生成** — 并行为每个组生成 commit message
5. **顺序提交** — 子包优先、根目录最后，逐个 `git add` + `git commit`

## Scope 自动推断

Spaceflow 会自动根据文件所属的 `package.json` 推断 scope：

```text
packages/cli/src/commands/build/build.service.ts  → scope: cli
packages/core/src/shared/logger/logger.ts         → scope: core
extensions/review/src/review.service.ts            → scope: review
package.json                             → scope: (空，根目录)
```

## Commit 类型

类型列表从 `spaceflow.json` 的 `publish.changelog.preset.type` 读取，默认值：

| 类型       | 含义     |
| ---------- | -------- |
| `feat`     | 新特性   |
| `fix`      | 修复 BUG |
| `perf`     | 性能优化 |
| `refactor` | 代码重构 |
| `docs`     | 文档更新 |
| `style`    | 代码格式 |
| `test`     | 测试用例 |
| `chore`    | 其他修改 |

## Scope 配置

在 `spaceflow.json` 中配置 `commit` 字段自定义 scope 策略：

```json
{
  "commit": {
    "strategy": "rules-first",
    "rules": [
      { "pattern": "docs/**", "scope": "docs" },
      { "pattern": ".github/**", "scope": "ci" },
      { "pattern": "*.config.*", "scope": "config" }
    ]
  }
}
```

### 策略说明

| 策略          | 说明                                       |
| ------------- | ------------------------------------------ |
| `package`     | 按 `package.json` 所属包推断 scope（默认） |
| `rules`       | 仅使用自定义 glob 规则匹配                 |
| `rules-first` | 优先规则匹配，未匹配的回退到包推断         |

## 命令行选项

| 选项          | 简写 | 说明                              |
| ------------- | ---- | --------------------------------- |
| `--dry-run`   | `-d` | 试运行，仅生成 message 不提交     |
| `--split`     | `-s` | 智能拆分为多个 commit             |
| `--no-verify` | `-n` | 跳过 git hooks                    |
| `--verbose`   | `-v` | 详细日志（`-v` 基本，`-vv` 详细） |

## 示例

```bash
# 普通提交
git add .
spaceflow commit

# 预览生成的 message
git add .
spaceflow commit --dry-run

# 智能拆分（自动 git add 工作区文件）
spaceflow commit --split

# 拆分 + 预览
spaceflow commit --split --dry-run

# 详细日志查看 AI 交互过程
spaceflow commit -vv
```

## 输出示例

### 普通模式

```text
正在生成 commit message...
──────────────────────────────────────────────────
feat(core): 添加 Logger 模块支持 TUI 和 Plain 两种渲染模式
──────────────────────────────────────────────────
提交成功
```

### Split 模式

```text
按包目录分组策略分组...
检测到 3 个分组
并行生成 3 个 commit message...
✅ Commit 1: feat(core): 添加 Logger 模块
✅ Commit 2: feat(cli): 集成 Logger 到 build 命令
✅ Commit 3: docs: 更新 Logger 文档
分批提交完成，共 3 个 commit
```
