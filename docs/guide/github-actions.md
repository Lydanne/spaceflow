# GitHub Actions

Spaceflow 提供预配置的 GitHub Actions，可以在 CI 中自动执行各种命令。

## 官方 Action

### 基本用法

```yaml
- uses: Lydanne/spaceflow@main
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    command: review
```

### 输入参数

| 参数                | 必填 | 说明                              |
| ------------------- | ---- | --------------------------------- |
| `github-token`      | ✅   | GitHub Token                      |
| `github-server-url` | ❌   | GitHub Server URL（默认自动检测） |
| `command`           | ✅   | 要执行的 spaceflow 命令           |

## 预配置工作流

### 自动 PR 审查

在 PR 创建或更新时自动执行 AI 代码审查：

```yaml
# .github/workflows/pr-review.yml
name: PR Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: Lydanne/spaceflow@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          command: review
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### 手动触发 PR 审查

通过 PR 评论触发审查（如输入 `/review`）：

```yaml
# .github/workflows/pr-review-command.yml
name: PR Review Command

on:
  issue_comment:
    types: [created]

jobs:
  review:
    if: >
      github.event.issue.pull_request &&
      contains(github.event.comment.body, '/review')
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: Lydanne/spaceflow@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          command: review
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### 自动版本发布

```yaml
# .github/workflows/publish.yml
name: Publish

on:
  push:
    branches: [main]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      packages: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org

      - run: pnpm install --frozen-lockfile

      - uses: Lydanne/spaceflow@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          command: publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 执行自定义命令

```yaml
# .github/workflows/test-command.yml
name: Run Command

on:
  workflow_dispatch:
    inputs:
      command:
        description: "要执行的 spaceflow 命令"
        required: true

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: Lydanne/spaceflow@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          command: ${{ github.event.inputs.command }}
```

## 环境变量配置

在 GitHub 仓库的 Settings → Secrets and variables → Actions 中配置：

| Secret              | 说明                               |
| ------------------- | ---------------------------------- |
| `OPENAI_API_KEY`    | OpenAI API Key（review 命令需要）  |
| `ANTHROPIC_API_KEY` | Anthropic API Key（可选）          |
| `NPM_TOKEN`         | npm 发布 Token（publish 命令需要） |
| `FEISHU_APP_ID`     | 飞书 App ID（通知需要）            |
| `FEISHU_APP_SECRET` | 飞书 App Secret（通知需要）        |

::: tip
`GITHUB_TOKEN` 由 GitHub Actions 自动注入，无需手动配置。
:::

## 权限配置

根据使用的命令，需要配置不同的权限：

| 命令      | 需要的权限                               |
| --------- | ---------------------------------------- |
| `review`  | `contents: read`, `pull-requests: write` |
| `publish` | `contents: write`, `packages: write`     |
| `scripts` | `contents: read`                         |
| `shell`   | `contents: read`                         |
