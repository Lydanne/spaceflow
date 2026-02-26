# @spaceflow/shared

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> 轻量公共工具库，`@spaceflow/cli` 和 `@spaceflow/core` 共同依赖。

## 定位

`@spaceflow/shared` 提供 CLI 壳子和 core 运行时都需要的基础工具函数，避免 CLI 直接依赖 core 的重量级模块。

## 模块

| 模块              | 说明                                                             |
| ----------------- | ---------------------------------------------------------------- |
| `config`          | 配置文件读写（`readConfigSync`、`writeConfigSync`、`deepMerge`） |
| `spaceflow-dir`   | `.spaceflow/` 工作目录管理                                       |
| `package-manager` | 包管理器检测（pnpm / npm）                                       |
| `source-utils`    | 源类型判断（npm / git / local）                                  |
| `editor-config`   | 编辑器目录映射                                                   |
| `verbose`         | 日志级别定义与解析                                               |

## 主要导出

```typescript
// 配置
import {
  readConfigSync,
  writeConfigSync,
  deepMerge,
  getConfigPath,
  getDependencies,
  updateDependency,
  removeDependency,
  getSupportedEditors,
} from "@spaceflow/shared";

// .spaceflow/ 目录
import {
  ensureSpaceflowDir,
  ensureSpaceflowPackageJson,
  ensureDependencies,
  loadExtensionsFromDir,
  SPACEFLOW_DIR,
} from "@spaceflow/shared";

// 包管理器
import {
  getPackageManager,
  detectPackageManager,
  isPnpmWorkspace,
} from "@spaceflow/shared";

// 源类型
import {
  getSourceType,
  isGitUrl,
  isLocalPath,
  normalizeSource,
  extractNpmPackageName,
} from "@spaceflow/shared";

// 编辑器
import {
  EDITOR_DIR_MAPPING,
  DEFAULT_EDITOR,
  getEditorDirName,
} from "@spaceflow/shared";

// 日志级别
import { shouldLog, normalizeVerbose, parseVerbose } from "@spaceflow/shared";
```

## 依赖关系

```text
@spaceflow/cli ──→ @spaceflow/shared
@spaceflow/core ─→ @spaceflow/shared（重导出部分模块）
```

## 许可证

[MIT](../../LICENSE)
