# 配置文件

Spaceflow 支持 `spaceflow.json` 和 `.spaceflowrc` 两种配置文件格式，内容完全一致。

## 配置文件位置

按以下优先级查找配置文件（从低到高，后者覆盖前者）：

1. `~/.spaceflow/spaceflow.json`（全局配置）
2. `~/.spaceflowrc`（全局 RC 文件）
3. `.spaceflow/spaceflow.json`（项目配置）
4. `.spaceflowrc`（项目 RC 文件，最高优先级）

## 基本结构

```json
{
  "$schema": ".spaceflow/config-schema.json",
  "support": ["claudeCode"],
  "dependencies": {
    "@spaceflow/review": "latest"
  },
  "review": { ... },
  "publish": { ... }
}
```

## 配置项

### `support`

配置需要关联的 AI 编辑器。安装 Extension 时，会将资源关联到对应编辑器目录。

```json
{
  "support": ["claudeCode", "windsurf", "cursor"]
}
```

| 值           | 编辑器目录   |
| ------------ | ------------ |
| `claudeCode` | `.claude/`   |
| `windsurf`   | `.windsurf/` |
| `cursor`     | `.cursor/`   |
| `opencode`   | `.opencode/` |

默认值为 `["claudeCode"]`。

### `dependencies`

已安装的外部 Extension 注册表。由 `spaceflow install` 命令自动管理。

```json
{
  "dependencies": {
    "@spaceflow/review": "latest",
    "@spaceflow/publish": "workspace:*",
    "@spaceflow/shell": "link:./extensions/shell"
  }
}
```

支持的值格式：

| 格式              | 类型     | 示例                                      |
| ----------------- | -------- | ----------------------------------------- |
| `latest` / `^1.0` | npm 版本 | `"latest"`, `"^1.0.0"`                    |
| `workspace:*`     | 工作区   | `"workspace:*"`                           |
| `link:./path`     | 本地链接 | `"link:./extensions/review"`              |
| `git+ssh://...`   | Git 仓库 | `"git+ssh://git@github.com/org/repo.git"` |

### `lang`

界面语言设置。

```json
{
  "lang": "zh-CN"
}
```

支持 `zh-CN`（默认）和 `en`。

### `gitProvider`

Git 平台配置。

```json
{
  "gitProvider": {
    "provider": "github",
    "serverUrl": "https://api.github.com"
  }
}
```

### `review`

AI 代码审查相关配置（需安装 `@spaceflow/review`）。

```json
{
  "review": {
    "references": ["./references"],
    "includes": ["*/**/*.ts", "!*/**/*.spec.*", "!*/**/*.config.*"],
    "generateDescription": true,
    "autoUpdatePrTitle": true,
    "lineComments": true,
    "verifyFixes": true,
    "analyzeDeletions": false,
    "deletionAnalysisMode": "open-code",
    "concurrency": 10,
    "retries": 3,
    "retryDelay": 1000
  }
}
```

| 字段                   | 类型       | 默认值        | 说明                                     |
| ---------------------- | ---------- | ------------- | ---------------------------------------- |
| `references`           | `string[]` | `[]`          | 审查规范来源，支持本地路径和远程仓库 URL |
| `includes`             | `string[]` | `["*/**/*"]`  | 审查文件匹配模式（glob）                 |
| `generateDescription`  | `boolean`  | `false`       | 是否自动生成 PR 描述                     |
| `autoUpdatePrTitle`    | `boolean`  | `false`       | 是否自动更新 PR 标题                     |
| `lineComments`         | `boolean`  | `true`        | 是否生成行内评论                         |
| `verifyFixes`          | `boolean`  | `false`       | 是否验证修复建议                         |
| `analyzeDeletions`     | `boolean`  | `false`       | 是否分析删除代码的影响                   |
| `deletionAnalysisMode` | `string`   | `"open-code"` | 删除分析模式                             |
| `concurrency`          | `number`   | `10`          | 并发审查文件数                           |
| `retries`              | `number`   | `3`           | 失败重试次数                             |
| `retryDelay`           | `number`   | `1000`        | 重试间隔（毫秒）                         |

### `publish`

版本发布相关配置（需安装 `@spaceflow/publish`），基于 [release-it](https://github.com/release-it/release-it)。

```json
{
  "publish": {
    "monorepo": { "enabled": true, "propagateDeps": true },
    "changelog": {
      "preset": {
        "type": [
          { "type": "feat", "section": "新特性" },
          { "type": "fix", "section": "修复BUG" },
          { "type": "perf", "section": "性能优化" },
          { "type": "refactor", "section": "代码重构" }
        ]
      }
    },
    "npm": {
      "publish": true,
      "packageManager": "pnpm",
      "tag": "latest"
    },
    "git": {
      "lockBranch": false,
      "pushWhitelistUsernames": ["github-actions[bot]"]
    }
  }
}
```

### `commit`

AI 智能提交相关配置。

```json
{
  "commit": {
    "strategy": "rules-first",
    "rules": [
      { "pattern": "docs/**", "scope": "docs" },
      { "pattern": ".github/**", "scope": "ci" }
    ]
  }
}
```

## 配置优先级

1. **命令行参数**（最高优先级）
2. **环境变量**
3. **项目配置文件**（`.spaceflowrc` > `.spaceflow/spaceflow.json`）
4. **全局配置文件**（`~/.spaceflowrc` > `~/.spaceflow/spaceflow.json`）
5. **Extension 默认值**（最低优先级）

## JSON Schema

运行以下命令生成配置的 JSON Schema，获得编辑器自动补全支持：

```bash
spaceflow schema
```

生成的 Schema 文件位于 `.spaceflow/config-schema.json`，在配置文件中通过 `$schema` 字段引用：

```json
{
  "$schema": ".spaceflow/config-schema.json"
}
```
