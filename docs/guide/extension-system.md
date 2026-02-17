# Extension 系统

Spaceflow 的所有功能命令都以 Extension 形式组织。Extension 分为**内置命令**和**外部 Extension** 两类。

## Extension 类型

### 内置命令

内置在 `@spaceflow/cli` 中，无需安装即可使用：

| 命令        | 说明                 |
| ----------- | -------------------- |
| `install`   | 安装 Extension       |
| `uninstall` | 卸载 Extension       |
| `update`    | 更新 Extension       |
| `build`     | 构建 Extension       |
| `dev`       | 开发模式             |
| `create`    | 创建 Extension 模板  |
| `list`      | 列出已安装 Extension |
| `clear`     | 清理缓存             |
| `commit`    | Git 提交辅助         |
| `setup`     | 编辑器配置           |
| `schema`    | 生成 JSON Schema     |
| `mcp`       | MCP 服务             |
| `runx`      | 运行外部命令         |

### 外部 Extension

独立的 npm 包，需要通过 `spaceflow install` 安装：

| Extension      | 包名                        | 说明           |
| -------------- | --------------------------- | -------------- |
| review         | `@spaceflow/review`         | AI 代码审查    |
| publish        | `@spaceflow/publish`        | 版本发布       |
| scripts        | `@spaceflow/scripts`        | 自定义脚本执行 |
| shell          | `@spaceflow/shell`          | Shell 命令执行 |
| review-summary | `@spaceflow/review-summary` | 审查总结       |

## Extension 生命周期

```text
install → 注册到 spaceflow.json → CLI 启动时加载 → 注入 NestJS 模块 → 可用
```

1. **安装** — `spaceflow install <package>` 下载并注册
2. **注册** — 写入 `spaceflow.json` 的 `dependencies` 字段
3. **加载** — CLI 启动时，`ExtensionLoaderService` 扫描并加载所有已注册 Extension
4. **注入** — Extension 的 NestJS Module 被动态注入到 CLI 应用中
5. **执行** — 用户通过 `spaceflow <command>` 调用

## Extension 接口

每个 Extension 必须实现 `SpaceflowExtension` 接口：

```typescript
import type {
  SpaceflowExtension,
  SpaceflowExtensionMetadata,
} from "@spaceflow/core";

export class ReviewExtension implements SpaceflowExtension {
  getMetadata(): SpaceflowExtensionMetadata {
    return {
      name: "review",
      commands: ["review"],
      configKey: "review",
      description: "AI 代码审查",
    };
  }

  getModule() {
    return ReviewModule;
  }
}
```

### SpaceflowExtensionMetadata

| 字段          | 类型                                     | 必填 | 说明                               |
| ------------- | ---------------------------------------- | ---- | ---------------------------------- |
| `name`        | `string`                                 | ✅   | Extension 名称                     |
| `commands`    | `string[]`                               | ✅   | 提供的命令列表                     |
| `configKey`   | `string`                                 | ❌   | 对应 `spaceflow.json` 中的配置 key |
| `description` | `string`                                 | ❌   | Extension 描述                     |
| `version`     | `string`                                 | ❌   | 版本号                             |
| `locales`     | `Record<string, Record<string, string>>` | ❌   | i18n 语言资源                      |

## 管理命令

```bash
# 安装
spaceflow install @spaceflow/review

# 卸载
spaceflow uninstall review

# 更新
spaceflow update

# 列出
spaceflow list
```

## 开发 Extension

请参考 [插件开发指南](/advanced/plugin-development) 了解如何创建自定义 Extension。
