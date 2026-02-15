# Review Spec 规范

Review Spec 是 Spaceflow 中用于定义代码审查规则的 Markdown 格式文档。AI 审查系统会读取这些规范，并据此对代码进行自动化审查。

## 文件命名规则

规范文件名必须遵循以下格式：

```text
<扩展名>.<类型>.md
```

| 部分 | 说明 | 示例 |
|------|------|------|
| 扩展名 | 适用的文件扩展名，多个用 `&` 连接 | `js&ts`, `vue`, `tsx` |
| 类型 | 规范类型，可多级，用 `.` 分隔 | `nest`, `test-code`, `file-name` |
| 后缀 | 必须是 `.md` | `.md` |

示例：

```text
js&ts.nest.md           # JS/TS NestJS 项目规范
js&ts.file-name.md      # JS/TS 文件命名规范
js&ts.test-code.md      # JS/TS 测试代码规范
vue.base.md             # Vue 基础规范
```

## 文件结构

### 文件级配置

位于文件开头，使用 blockquote 语法：

```markdown
> - includes `*.controller.ts` `*.service.ts`
> - severity `warn`
> - override `[JsTs.FileName]`
```

### 规则定义

使用二级标题定义规则：

````markdown
## 规则标题 `[规则ID]`

规则描述...

### Good

```typescript
// 推荐代码示例
```

### Bad

```typescript
// 不推荐代码示例
```
````

## 文件级配置项

### `includes`

指定规范适用的文件路径模式（glob）。

```markdown
> - includes `**/*.controller.ts` `**/*.service.ts`
```

- 支持 `*`（任意字符）和 `**`（任意层级）
- 多个模式用空格分隔，包裹在反引号中

### `severity`

指定规则的默认严重程度。

```markdown
> - severity `warn`
```

| 值 | 含义 | 显示 | 阻止合并 |
|----|------|------|----------|
| `error` | 错误 | 🔴 红色 | 通常阻止 |
| `warn` | 警告 | 🟡 黄色 | 通常不阻止 |
| `off` | 关闭 | 不显示 | 否 |

### `override`

排除其他规范文件中的规则，支持前缀匹配。

```markdown
> - override `[JsTs.FileName]`
```

排除所有以 `JsTs.FileName` 开头的规则（包括 `JsTs.FileName.UpperCamel` 等子规则）。

## 规则级配置

可以在规则内容中使用 blockquote 覆盖文件级配置：

```markdown
## 服务规范 `[JsTs.Nest.Service]`

服务文件包含业务逻辑...

> - severity `warn`
```

## 规则 ID 命名

规则 ID 支持多级命名，使用 `.` 分隔：

```markdown
## 主规则 `[JsTs.Nest]`
## 控制器规范 `[JsTs.Nest.Controller]`
## 服务规范 `[JsTs.Nest.Service]`
```

## 远程规范仓库

支持从 Git 仓库加载规范文件：

```json
{
  "review": {
    "references": [
      "./references",
      "https://github.com/your-org/review-spec"
    ]
  }
}
```

### 支持的 URL 格式

| 格式 | 示例 |
|------|------|
| GitHub 仓库 | `https://github.com/org/repo` |
| GitHub 目录 | `https://github.com/org/repo/tree/main/references` |
| Gitea 仓库 | `https://git.example.com/org/repo` |
| Gitea 目录 | `https://git.example.com/org/repo/src/branch/main/references` |
| SSH | `git@host:owner/repo.git` |
| SSH（完整） | `git+ssh://git@host/owner/repo.git` |

远程规范会缓存到 `~/.spaceflow/review-spec-cache/`，TTL 为 5 分钟（CI 环境中每次拉取最新）。

## 完整示例

````markdown
# NestJS 项目规范 `[JsTs.Nest]`

> - includes `*.controller.ts` `*.service.ts` `*.module.ts`
> - severity `error`
> - override `[JsTs.FileName]`

## 控制器规范 `[JsTs.Nest.Controller]`

控制器文件不能包含业务逻辑，只能调用 service 方法。

### Good

```typescript
@Controller("user")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async getUser(@Param("id") id: string) {
    return this.userService.findById(id);
  }
}
```

### Bad

```typescript
@Controller("user")
export class UserController {
  @Get()
  async getUser(@Param("id") id: string) {
    const user = await db.query("SELECT * FROM users WHERE id = ?", [id]);
    return user;
  }
}
```

## 服务规范 `[JsTs.Nest.Service]`

服务文件包含业务逻辑，必须通过 model 访问数据库。

> - severity `warn`

### Good

```typescript
@Injectable()
export class UserService {
  constructor(private readonly userModel: UserModel) {}

  async getUser(id: string) {
    return this.userModel.findById(id);
  }
}
```
````

## 最佳实践

- **规则 ID 命名** — 使用有意义的层级结构，如 `语言.类型.规则名`
- **代码示例** — 提供清晰的 Good/Bad 示例
- **严重程度** — 合理设置 severity，避免过多 error 阻塞开发
- **文件组织** — 按功能或类型组织规则文件，避免单个文件过大
- **includes 精确** — 使用精确的文件路径匹配，避免误匹配
