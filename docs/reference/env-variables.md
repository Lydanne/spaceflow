# 环境变量

Spaceflow 使用的所有环境变量参考。

## 通用

| 变量             | 说明                 | 默认值  |
| ---------------- | -------------------- | ------- |
| `SPACEFLOW_LANG` | 界面语言             | `zh-CN` |
| `CI`             | 是否在 CI 环境中运行 | —       |

## MCP

| 变量                  | 说明                                                                                     | 默认值 |
| --------------------- | ---------------------------------------------------------------------------------------- | ------ |
| `SPACEFLOW_CWD`       | 指定工作区路径，优先于 `process.cwd()`。Meta-tool 代理模式下由系统自动传入，无需手动设置 | —      |
| `SPACEFLOW_MCP_PROXY` | 内部标记。设为 `1` 时表示当前进程由 Meta-tool 代理 spawn，防止递归进入代理模式           | —      |

## Git Provider

| 变量                 | 说明                                          | 默认值                   |
| -------------------- | --------------------------------------------- | ------------------------ |
| `GIT_PROVIDER_TYPE`  | Git 平台类型（`github` / `gitea` / `gitlab`） | 自动检测                 |
| `GIT_PROVIDER_URL`   | 通用 Git Provider URL（最高优先级）           | —                        |
| `GIT_PROVIDER_TOKEN` | 通用 Git Provider Token（最高优先级）         | —                        |
| `GITHUB_TOKEN`       | GitHub API Token                              | —                        |
| `GITHUB_SERVER_URL`  | GitHub Server URL                             | `https://github.com`     |
| `GITHUB_API_URL`     | GitHub API URL                                | `https://api.github.com` |
| `GITEA_TOKEN`        | Gitea API Token                               | —                        |
| `GITEA_SERVER_URL`   | Gitea Server URL                              | —                        |
| `GITEA_API_URL`      | Gitea API URL                                 | —                        |

::: tip 自动检测逻辑

- 提供 `GITEA_TOKEN` → 识别为 `gitea`
- 提供 `GITLAB_TOKEN` 或 `CI_JOB_TOKEN` → 识别为 `gitlab`
- 提供 `GITHUB_TOKEN` → 识别为 `github`
- 都未提供 → 默认 `github`
- 可通过 `GIT_PROVIDER_TYPE` 显式覆盖

所有 `GITHUB_` 前缀的环境变量均支持 `GITEA_` 前缀作为 fallback，方便在 Gitea Actions 中使用。
:::

## LLM 配置

### OpenAI

| 变量              | 说明                | 默认值                      |
| ----------------- | ------------------- | --------------------------- |
| `OPENAI_API_KEY`  | OpenAI API Key      | —                           |
| `OPENAI_BASE_URL` | OpenAI API Base URL | `https://api.openai.com/v1` |
| `OPENAI_MODEL`    | 模型名称            | `gpt-4o`                    |

### Claude

| 变量                | 说明              | 默认值 |
| ------------------- | ----------------- | ------ |
| `ANTHROPIC_API_KEY` | Anthropic API Key | —      |

### Claude Code

| 变量                     | 说明                       | 默认值            |
| ------------------------ | -------------------------- | ----------------- |
| `CLAUDE_CODE_BASE_URL`   | Claude Code Agent Base URL | —                 |
| `CLAUDE_CODE_AUTH_TOKEN` | Claude Code Auth Token     | —                 |
| `CLAUDE_CODE_MODEL`      | 模型名称                   | `ark-code-latest` |

### OpenCode

| 变量               | 说明             | 默认值 |
| ------------------ | ---------------- | ------ |
| `OPENCODE_API_KEY` | OpenCode API Key | —      |

## 飞书

| 变量                | 说明                | 默认值 |
| ------------------- | ------------------- | ------ |
| `FEISHU_APP_ID`     | 飞书应用 App ID     | —      |
| `FEISHU_APP_SECRET` | 飞书应用 App Secret | —      |

## CI 环境变量

在 GitHub Actions / Gitea Actions 中使用时，以下变量会自动注入：

| GitHub Actions      | Gitea Actions      | 说明                     |
| ------------------- | ------------------ | ------------------------ |
| `GITHUB_TOKEN`      | `GITEA_TOKEN`      | 自动注入的 Token         |
| `GITHUB_SERVER_URL` | `GITEA_SERVER_URL` | Server URL               |
| `GITHUB_REPOSITORY` | `GITEA_REPOSITORY` | 仓库全名（`owner/repo`） |
| `GITHUB_REF_NAME`   | `GITEA_REF_NAME`   | 当前分支名称             |
| `GITHUB_EVENT_PATH` | `GITEA_EVENT_PATH` | 事件文件路径             |
| `GITHUB_ACTOR`      | `GITEA_ACTOR`      | 当前操作者               |

::: info
Spaceflow 同时读取 `GITHUB_` 和 `GITEA_` 前缀的环境变量，`GITHUB_` 优先。在 Gitea Actions 中无需额外配置即可正常使用。
:::

## 使用示例

### 本地开发（GitHub）

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
export OPENAI_API_KEY=sk-xxxxxxxxxxxx
spaceflow review -p 123
```

### 本地开发（Gitea）

```bash
export GIT_PROVIDER_TYPE=gitea
export GITEA_TOKEN=your_gitea_token
export GITEA_SERVER_URL=https://your-gitea.com
export OPENAI_API_KEY=sk-xxxxxxxxxxxx
spaceflow review -p 123
```

### GitHub Actions CI

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### Gitea Actions CI

```yaml
env:
  GIT_PROVIDER_TYPE: gitea
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  # GITEA_TOKEN 和 GITEA_SERVER_URL 由 Gitea Actions 自动注入
```
