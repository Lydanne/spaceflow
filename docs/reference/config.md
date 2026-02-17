# 配置参考

`spaceflow.json` 完整配置项参考。

## 配置文件位置

按优先级从低到高排列，后者覆盖前者：

| 优先级    | 路径                          | 说明         |
| --------- | ----------------------------- | ------------ |
| 1（最低） | `~/.spaceflow/spaceflow.json` | 全局配置     |
| 2         | `~/.spaceflowrc`              | 全局 RC 文件 |
| 3         | `.spaceflow/spaceflow.json`   | 项目配置     |
| 4（最高） | `.spaceflowrc`                | 项目 RC 文件 |

## 完整配置示例

```json
{
  "$schema": "./.spaceflow/config-schema.json",
  "lang": "zh-CN",
  "support": ["claudeCode", "windsurf", "cursor"],
  "review": {
    "references": ["./references", "https://github.com/org/review-spec"],
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
  },
  "publish": {
    "monorepo": { "enabled": true, "propagateDeps": true },
    "changelog": {
      "preset": {
        "type": [
          { "type": "feat", "section": "新特性" },
          { "type": "fix", "section": "修复BUG" },
          { "type": "perf", "section": "性能优化" },
          { "type": "refactor", "section": "代码重构" },
          { "type": "docs", "section": "文档更新" },
          { "type": "style", "section": "代码格式" },
          { "type": "test", "section": "测试用例" },
          { "type": "chore", "section": "其他修改" }
        ]
      }
    },
    "npm": {
      "publish": true,
      "packageManager": "pnpm",
      "tag": "latest",
      "ignoreVersion": true,
      "versionArgs": ["--workspaces false"]
    },
    "git": {
      "pushWhitelistUsernames": ["github-actions[bot]"]
    }
  },
  "dependencies": {
    "@spaceflow/review": "link:./extensions/review",
    "@spaceflow/publish": "link:./extensions/publish",
    "@spaceflow/shell": "link:./extensions/shell",
    "@spaceflow/scripts": "link:./extensions/scripts"
  }
}
```

## 顶层字段

### `$schema`

- **类型**：`string`
- **说明**：JSON Schema 路径，用于编辑器自动补全
- **示例**：`"./.spaceflow/config-schema.json"`

### `lang`

- **类型**：`string`
- **默认值**：`"zh-CN"`
- **说明**：界面语言。支持 `zh-CN`、`en`

### `support`

- **类型**：`string[]`
- **默认值**：`["claudeCode"]`
- **说明**：需要关联的 AI 编辑器列表
- **可选值**：`"claudeCode"` | `"windsurf"` | `"cursor"` | `"opencode"`

### `dependencies`

- **类型**：`Record<string, string>`
- **说明**：已安装的外部 Extension 注册表，由 `spaceflow install` 自动管理

## review 配置

| 字段                   | 类型       | 默认值        | 说明                                   |
| ---------------------- | ---------- | ------------- | -------------------------------------- |
| `references`           | `string[]` | `[]`          | 审查规范来源（本地目录或远程仓库 URL） |
| `includes`             | `string[]` | `["*/**/*"]`  | 审查文件匹配模式（glob）               |
| `generateDescription`  | `boolean`  | `false`       | 自动生成 PR 描述                       |
| `autoUpdatePrTitle`    | `boolean`  | `false`       | 自动更新 PR 标题                       |
| `lineComments`         | `boolean`  | `true`        | 生成行内评论                           |
| `verifyFixes`          | `boolean`  | `false`       | 验证修复建议                           |
| `analyzeDeletions`     | `boolean`  | `false`       | 分析删除代码影响                       |
| `deletionAnalysisMode` | `string`   | `"open-code"` | 删除分析模式                           |
| `concurrency`          | `number`   | `10`          | 并发审查文件数                         |
| `retries`              | `number`   | `3`           | 失败重试次数                           |
| `retryDelay`           | `number`   | `1000`        | 重试间隔（毫秒）                       |

### `references` 支持的格式

| 格式        | 示例                                                 |
| ----------- | ---------------------------------------------------- |
| 本地目录    | `"./references"`                                     |
| GitHub 仓库 | `"https://github.com/org/review-spec"`               |
| GitHub 目录 | `"https://github.com/org/repo/tree/main/references"` |
| Gitea 仓库  | `"https://git.example.com/org/review-spec"`          |
| SSH         | `"git+ssh://git@github.com/org/repo.git"`            |

## publish 配置

### `publish.monorepo`

| 字段            | 类型      | 默认值  | 说明               |
| --------------- | --------- | ------- | ------------------ |
| `enabled`       | `boolean` | `false` | 启用 Monorepo 模式 |
| `propagateDeps` | `boolean` | `false` | 传播依赖版本更新   |

### `publish.changelog`

变更日志配置，基于 [conventional-changelog](https://github.com/conventional-changelog/conventional-changelog)。

### `publish.npm`

| 字段             | 类型      | 默认值     | 说明           |
| ---------------- | --------- | ---------- | -------------- |
| `publish`        | `boolean` | `true`     | 是否发布到 npm |
| `packageManager` | `string`  | `"pnpm"`   | 包管理器       |
| `tag`            | `string`  | `"latest"` | npm tag        |
| `ignoreVersion`  | `boolean` | `false`    | 忽略版本检查   |

### `publish.git`

| 字段                     | 类型       | 说明                   |
| ------------------------ | ---------- | ---------------------- |
| `pushWhitelistUsernames` | `string[]` | 允许推送的用户名白名单 |
