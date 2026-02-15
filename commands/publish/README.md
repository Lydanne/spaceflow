# @spaceflow/publish

Spaceflow CI 发布插件，基于 [release-it](https://github.com/release-it/release-it) 实现自动化版本发布。

## 功能特性

- **Monorepo 支持** — 自动检测变更包，按依赖拓扑顺序发布
- **分支保护** — 发布期间自动锁定分支，防止其他推送干扰
- **Conventional Changelog** — 基于 conventional commits 自动生成 CHANGELOG
- **GitHub Release** — 自动创建 GitHub Release 并上传资产文件
- **预发布支持** — 支持 rc、beta、alpha 等预发布版本
- **进程退出保护** — 即使发布失败也能自动解锁分支

## 安装

`@spaceflow/publish` 是 `@spaceflow/cli` 的内置命令，安装 CLI 后即可使用：

```bash
# 使用 pnpm
pnpm add -D @spaceflow/cli

pnpm spaceflow install @spaceflow/publish
```

然后在项目根目录创建 `spaceflow.json` 配置文件：

```json
{
  "publish": {
    "monorepo": {
      "enabled": true
    },
    "git": {
      "lockBranch": true,
      "pushWhitelistUsernames": ["github-actions[bot]"]
    }
  }
}
```

## 命令行参数

```bash
# 发布
spaceflow publish [options]

# 预演
spaceflow publish --rehearsal
```

| 参数                     | 说明                                            |
| ------------------------ | ----------------------------------------------- |
| `-d, --dry-run`          | 仅打印将要执行的操作，不实际执行                |
| `-c, --ci`               | 在 CI 环境中运行（自动 fetch tags）             |
| `-p, --prerelease <tag>` | 预发布标签，如 `rc`、`beta`、`alpha`、`nightly` |
| `-r, --rehearsal`        | 预演模式：执行 hooks 但不修改文件/git           |

## 配置

在 `spaceflow.json` 中配置 `publish` 字段：

```json
{
  "publish": {
    "monorepo": {
      "enabled": true,
      "propagateDeps": true
    },
    "changelog": {
      "preset": {
        "type": [
          { "type": "feat", "section": "新功能" },
          { "type": "fix", "section": "Bug 修复" },
          { "type": "refactor", "section": "代码重构" },
          { "type": "perf", "section": "性能优化" },
          { "type": "docs", "section": "文档更新" }
        ]
      }
    },
    "npm": {
      "publish": true,
      "packageManager": "pnpm",
      "registry": "https://registry.npmjs.org",
      "tag": "latest",
      "ignoreVersion": true,
      "versionArgs": ["--workspaces false"]
    },
    "release": {
      "host": "https://github.com",
      "assets": [{ "path": "dist/*.zip", "name": "dist.zip", "type": "zip" }]
    },
    "git": {
      "requireBranch": ["main", "dev", "develop"],
      "lockBranch": true,
      "pushWhitelistUsernames": ["github-actions[bot]"]
    },
    "hooks": {
      "before:bump": "echo 'Before bump'",
      "after:bump": ["pnpm build", "pnpm test"]
    }
  }
}
```

## 配置项说明

### monorepo

| 配置项          | 类型      | 默认值  | 说明                             |
| --------------- | --------- | ------- | -------------------------------- |
| `enabled`       | `boolean` | `false` | 是否启用 monorepo 发布模式       |
| `propagateDeps` | `boolean` | `true`  | 依赖的包变更时，依赖方是否也发布 |

### changelog

| 配置项        | 类型     | 默认值                  | 说明                          |
| ------------- | -------- | ----------------------- | ----------------------------- |
| `infileDir`   | `string` | `"."`                   | CHANGELOG 文件输出目录        |
| `preset.name` | `string` | `"conventionalcommits"` | Changelog preset 名称         |
| `preset.type` | `array`  | `[]`                    | Commit type 到 section 的映射 |

### npm

| 配置项           | 类型              | 默认值                   | 说明                             |
| ---------------- | ----------------- | ------------------------ | -------------------------------- |
| `publish`        | `boolean`         | `false`                  | 是否发布到 npm registry          |
| `packageManager` | `"npm" \| "pnpm"` | `"npm"`                  | 包管理器                         |
| `registry`       | `string`          | -                        | npm registry 地址                |
| `tag`            | `string`          | `"latest"`               | npm tag                          |
| `ignoreVersion`  | `boolean`         | `true`                   | 是否忽略 package.json 中的版本号 |
| `versionArgs`    | `string[]`        | `["--workspaces false"]` | npm version 命令额外参数         |
| `publishArgs`    | `string[]`        | `[]`                     | npm/pnpm publish 命令额外参数    |

### release

| 配置项           | 类型     | 默认值        | 说明                 |
| ---------------- | -------- | ------------- | -------------------- |
| `host`           | `string` | `"localhost"` | Git 服务器地址       |
| `assets`         | `array`  | `[]`          | Release 资产文件列表 |
| `assetSourcemap` | `object` | -             | Sourcemap 资产配置   |

### git

| 配置项                   | 类型       | 默认值                       | 说明                     |
| ------------------------ | ---------- | ---------------------------- | ------------------------ |
| `requireBranch`          | `string[]` | `["main", "dev", "develop"]` | 允许发布的分支列表       |
| `lockBranch`             | `boolean`  | `true`                       | 发布时是否锁定分支       |
| `pushWhitelistUsernames` | `string[]` | `[]`                         | 锁定期间允许推送的用户名 |

### hooks

支持 release-it 的所有 hooks，如：

- `before:init` / `after:init`
- `before:bump` / `after:bump`
- `before:release` / `after:release`

## 环境变量

| 变量                | 说明                                      |
| ------------------- | ----------------------------------------- |
| `GITHUB_TOKEN`      | GitHub API Token                          |
| `GITHUB_REPOSITORY` | 仓库名称（格式：`owner/repo`）            |
| `GITHUB_REF_NAME`   | 当前分支名称                              |
| `PUBLISH_REHEARSAL` | 预演模式标志（由 `--rehearsal` 自动设置） |

## CI 工作流示例

```yaml
name: Publish

on:
  push:
    branches: [main]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          fetch-tags: true

      - uses: pnpm/action-setup@v4

      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm spaceflow publish --ci
```

## 版本计算

版本号基于 [Conventional Commits](https://www.conventionalcommits.org/) 自动计算：

| Commit 类型       | 版本变更      |
| ----------------- | ------------- |
| `feat`            | Minor (0.x.0) |
| `fix`             | Patch (0.0.x) |
| `BREAKING CHANGE` | Major (x.0.0) |
| 其他              | Patch (0.0.x) |

## Monorepo 模式

启用 `monorepo.enabled: true` 后：

1. **变更检测**：基于 git diff 检测哪些包有变更
2. **依赖传递**：如果包 A 依赖包 B，且 B 有变更，A 也会被标记为需要发布
3. **拓扑排序**：被依赖的包先发布，确保依赖关系正确
4. **独立版本**：每个包有独立的版本号和 CHANGELOG
5. **Tag 格式**：`@scope/package@version`（如 `@spaceflow/cli@1.0.0`）

## 分支保护机制

发布期间会自动锁定分支，防止其他推送干扰发布流程：

1. **锁定**：创建分支保护规则，仅允许白名单用户推送
2. **发布**：执行版本更新、CHANGELOG 生成、git tag、npm publish
3. **解锁**：删除分支保护规则，恢复正常状态

即使发布过程中发生错误，也会通过 `process.on('exit')` 确保分支被解锁。
