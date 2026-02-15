# setup — 初始化配置

初始化 Spaceflow 项目配置，创建必要的目录和配置文件。

## 基本用法

```bash
# 本地初始化
spaceflow setup

# 全局初始化
spaceflow setup -g
```

## 本地初始化

在当前项目中创建 Spaceflow 配置：

```bash
spaceflow setup
```

执行以下操作：

1. **创建 `.spaceflow/` 目录** — 包含 `package.json`（用于管理 Extension 依赖）
2. **生成 JSON Schema** — 创建 `config-schema.json`，提供编辑器自动补全
3. **创建 `spaceflow.json`** — 默认配置文件（如果不存在）

生成的默认配置：

```json
{
  "$schema": "./config-schema.json",
  "support": ["claudeCode"]
}
```

::: tip
如果已存在 `spaceflow.json` 或 `.spaceflowrc`，不会覆盖。
:::

## 全局初始化

创建全局配置，合并本地配置和环境变量：

```bash
spaceflow setup -g
```

执行以下操作：

1. **创建 `~/.spaceflow/` 目录** — 全局配置目录
2. **读取本地配置** — 读取当前项目的 `spaceflow.json`
3. **读取 `.env` 文件** — 解析 `SPACEFLOW_` 前缀的环境变量
4. **合并配置** — 本地配置 < 实例配置 < 环境变量配置
5. **写入全局配置** — 保存到 `~/.spaceflow/spaceflow.json`

### 环境变量映射

`.env` 文件中以 `SPACEFLOW_` 开头的变量会自动转换为配置项：

```bash
# .env
SPACEFLOW_REVIEW_CONCURRENCY=20
SPACEFLOW_REVIEW_RETRIES=5
```

转换为：

```json
{
  "review": {
    "concurrency": "20",
    "retries": "5"
  }
}
```

::: warning
敏感信息（包含 `token`、`secret`、`password`、`key` 的字段）在输出时会显示为 `***`。
:::

## 命令行选项

| 选项 | 简写 | 说明 |
|------|------|------|
| `--global` | `-g` | 全局初始化 |
