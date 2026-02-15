# schema — 生成 Schema

生成 `spaceflow.json` 的 JSON Schema 文件，用于编辑器自动补全和校验。

## 基本用法

```bash
spaceflow schema
```

## 功能说明

执行后会在 `.spaceflow/` 目录下生成 `config-schema.json` 文件。

该 Schema 文件：

- 描述 `spaceflow.json` 的完整结构
- 包含所有已安装 Extension 的配置字段
- 提供字段类型、默认值、枚举值等元信息

## 在配置文件中引用

在 `spaceflow.json` 中添加 `$schema` 字段即可启用编辑器补全：

```json
{
  "$schema": "./.spaceflow/config-schema.json",
  "support": ["claudeCode"],
  "review": {
    "references": ["./references"]
  }
}
```

支持的编辑器：

- **VS Code** — 自动识别 `$schema` 字段，提供补全和校验
- **WebStorm / IntelliJ** — 自动识别 `$schema` 字段
- **其他支持 JSON Schema 的编辑器**

## 使用场景

- 安装新 Extension 后，重新生成 Schema 以获取新配置项的补全
- 项目初始化时，`spaceflow setup` 会自动调用此命令
