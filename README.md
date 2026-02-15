# spaceflow

Spaceflow 的工作流系统，提供统一的 CI/CD 管理和 AI 代码审查能力。

## 功能特性

- **统一管理手动触发的 CI**：提供统一的 UI 系统管理手动触发的 CI 任务
- **可扩展的 UI 界面**：支持命令行、Web 界面、飞书对话机器人等多种交互方式
- **可自定义的通知消息模板**：灵活配置通知消息格式
- **可扩展的通知方式**：支持多种通知渠道
- **按仓库隔离**：各仓库配置独立，互不干扰
- **PR 流程自动化**：AI 审核、ESLint 检查、重复代码检查、自定义仓库脚本等

## 项目结构

```bash
spaceflow/
├── actions/           # GitHub Actions
├── core/              # 核心服务（NestJS 应用）
│   └── src/
│       ├── commands/  # CLI 命令模块
│       │   ├── review/          # 代码审查
│       │   ├── publish/         # CI 发布
│       │   ├── ci-scripts/      # 自定义脚本执行
│       │   ├── ci-shell/        # Shell 命令执行
│       │   ├── claude-setup/    # Claude 配置
│       │   └── period-summary/  # 周期总结
│       └── shared/   # 共享模块
│           ├── feishu-sdk/      # 飞书 SDK
│           ├── git-sdk/         # Git 命令封装
│           ├── git-provider/    # Git Provider 适配器
│           ├── llm-proxy/       # LLM 统一代理
│           ├── review-spec/     # 审查规范管理
│           ├── review-report/   # 审查报告格式化
│           └── storage/         # 通用存储模块
├── .github/
│   └── workflows/     # GitHub Actions 工作流文件
└── spaceflow.json  # 项目配置
```

## 核心命令

### review

基于 LLM 的自动化代码审查，支持 OpenAI、Claude 等多种 LLM 模式。

```bash
# 审查 PR
npx spaceflow review -p 123 -l openai

# 审查两个分支之间的差异
npx spaceflow review -b main --head feature/xxx -l openai

# 仅分析删除代码
npx spaceflow review -p 123 --deletion-only -l openai
```

详细文档：[Review 模块文档](core/src/commands/review/README.md)

### publish

自动化版本发布，基于 release-it 实现版本管理和变更日志生成。

### ci-scripts

执行仓库中的自定义脚本。

### ci-shell

执行自定义 Shell 命令。

### claude-setup

配置 Claude CLI 工具。

### period-summary

生成周期性工作总结，支持飞书消息推送。

## 配置

在项目根目录创建 `spaceflow.json` 配置文件：

```javascript
export default {
  changelog: {
    preset: {
      type: [
        { type: "feat", section: "新特性" },
        { type: "fix", section: "修复BUG" },
        // 更多配置...
      ],
    },
  },
  review: {
    claudeCode: {
      baseUrl: process.env.CLAUDE_CODE_BASE_URL,
      authToken: process.env.CLAUDE_CODE_AUTH_TOKEN,
      model: process.env.CLAUDE_CODE_MODEL || "ark-code-latest",
    },
    openai: {
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-4o",
    },
    includes: ["*/**/*.ts", "!*/**/*.spec.*", "!*/**/*.config.*"],
    generateDescription: true,
    lineComments: true,
    verifyFixes: true,
    analyzeDeletions: true,
    concurrency: 10,
    retries: 3,
  },
  /**
   * 支持的编辑器列表，用于自动关联插件到对应的配置目录
   * 可选值: "claudeCode" (.claude), "windsurf" (.windsurf), "cursor" (.cursor), "opencode" (.opencode)
   * 默认值: ["claudeCode"]
   */
  support: ["claudeCode", "windsurf", "cursor"],
};
```

## 插件系统

Spaceflow 支持将插件自动关联到多个编辑器的配置目录中。通过在 `spaceflow.json` 中配置 `support` 字段，你可以让安装的技能和命令同时支持多个 AI 编程工具。

### 支持的编辑器

- **claudeCode**: 关联到 `.claude/`
- **windsurf**: 关联到 `.windsurf/`
- **cursor**: 关联到 `.cursor/`
- **opencode**: 关联到 `.opencode/`

### 自动关联逻辑

当你运行 `spaceflow install` 时，系统会：

1. 下载/链接插件到 `.spaceflow/` 目录。
2. 根据 `support` 配置，在对应的编辑器目录下创建 `skills` 或 `commands` 的符号链接。
3. 如果是全局安装 (`-g`)，则会关联到家目录下的对应编辑器目录（如 `~/.claude/`）。

## 开发

### 安装依赖

```bash
pnpm install
```

### 构建

```bash
pnpm build
```

### 运行测试

```bash
pnpm test
```

### 代码检查

```bash
pnpm lint
```

### 代码格式化

```bash
pnpm format
```

## GitHub Actions 工作流

项目包含多个预配置的 GitHub Actions 工作流：

- `pr-review.yml`：自动 PR AI 审查
- `pr-review-command.yml`：手动触发 PR 审查
- `core-command.yml`：运行任意 spaceflow 命令
- `actions-test.yml`：Actions 测试

## Git Flow

参考飞书文档

## 许可证

UNLICENSED
