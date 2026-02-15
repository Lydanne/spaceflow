# 环境变量

Spaceflow 使用的所有环境变量参考。

## 通用

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SPACEFLOW_LANG` | 界面语言 | `zh-CN` |
| `CI` | 是否在 CI 环境中运行 | — |

## Git Provider

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `GIT_PROVIDER_TYPE` | Git 平台类型（`github` / `gitea`） | 自动检测 |
| `GITHUB_TOKEN` | GitHub API Token | — |
| `GITHUB_SERVER_URL` | GitHub Server URL | `https://github.com` |
| `GITEA_TOKEN` | Gitea API Token（向后兼容） | — |
| `GITEA_SERVER_URL` | Gitea Server URL | — |

::: tip 自动检测逻辑
- 提供 `GITHUB_TOKEN` → 识别为 `github`
- 提供 `GITEA_TOKEN` → 识别为 `gitea`
- 都未提供 → 默认 `github`
- 可通过 `GIT_PROVIDER_TYPE` 显式覆盖
:::

## LLM 配置

### OpenAI

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENAI_API_KEY` | OpenAI API Key | — |
| `OPENAI_BASE_URL` | OpenAI API Base URL | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | 模型名称 | `gpt-4o` |

### Claude

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `ANTHROPIC_API_KEY` | Anthropic API Key | — |

### Claude Code

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `CLAUDE_CODE_BASE_URL` | Claude Code Agent Base URL | — |
| `CLAUDE_CODE_AUTH_TOKEN` | Claude Code Auth Token | — |
| `CLAUDE_CODE_MODEL` | 模型名称 | `ark-code-latest` |

### OpenCode

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENCODE_API_KEY` | OpenCode API Key | — |

## 飞书

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `FEISHU_APP_ID` | 飞书应用 App ID | — |
| `FEISHU_APP_SECRET` | 飞书应用 App Secret | — |

## GitHub Actions

在 GitHub Actions 中使用时，以下变量会自动注入：

| 变量 | 说明 |
|------|------|
| `GITHUB_TOKEN` | GitHub 自动注入的 Token |
| `GITHUB_SERVER_URL` | GitHub Server URL |
| `GITHUB_REPOSITORY` | 仓库全名（`owner/repo`） |
| `GITHUB_EVENT_NAME` | 事件类型 |
| `GITHUB_REF` | 触发分支/标签 |

## 使用示例

### 本地开发

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
export OPENAI_API_KEY=sk-xxxxxxxxxxxx
spaceflow review -p 123
```

### CI 环境

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```
