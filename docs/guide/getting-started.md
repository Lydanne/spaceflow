# 快速开始

## 安装

### 全局安装

```bash
npm install -g @spaceflow/cli
# 或
pnpm add -g @spaceflow/cli
```

安装完成后，你可以通过 `spaceflow` 或简写 `space` 来调用命令。

### 验证安装

```bash
spaceflow --help
```

## 初始化项目

运行 `spaceflow setup` 初始化项目，或手动创建 `.spaceflow/spaceflow.json` 配置文件：

```json
{
  "review": {
    "references": ["./references"],
    "includes": ["*/**/*.ts", "!*/**/*.spec.*"],
    "generateDescription": true,
    "lineComments": true,
    "concurrency": 10
  },
  "support": ["claudeCode"]
}
```

## 安装 Extension

使用 `install` 命令安装外部 Extension：

```bash
# 安装 review Extension
spaceflow install @spaceflow/review

# 安装 publish Extension
spaceflow install @spaceflow/publish
```

安装后，Extension 会被注册到 `spaceflow.json` 的 `dependencies` 字段中。

## 常用命令

### 代码审查

```bash
# 审查指定 PR
spaceflow review -p 123

# 审查两个分支之间的差异
spaceflow review -b main --head feature/xxx

# 使用指定 LLM 模式
spaceflow review -p 123 -l openai
```

### 版本发布

```bash
# 发布版本
spaceflow publish

# 试运行（不实际发布）
spaceflow publish --dry-run
```

### 查看已安装的 Extension

```bash
spaceflow list
```

### 构建 Extension

```bash
# 构建所有 Extension
spaceflow build

# 监听模式
spaceflow build --watch
```

## 在 CI 中使用

Spaceflow 提供了预配置的 GitHub Actions，可以在 PR 中自动执行代码审查：

```yaml
# .github/workflows/pr-review.yml
name: PR Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: nicepkg/spaceflow/actions@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          command: review
```

详细的 CI 配置请参考 [GitHub Actions](/advanced/github-actions)。

## 下一步

- 了解 [项目结构](/guide/project-structure)
- 配置 [spaceflow.json](/guide/configuration)
- 探索 [Extension 系统](/guide/extension-system)
