# 权限模式系统

## 概述

Teax 支持基于 Glob 模式的细粒度权限控制，允许管理员创建更精确的权限规则。

## 权限格式

```
<group>:<action>[:<resource-pattern>]
```

- **group**: 权限分组（repo, actions, agent, page 等）
- **action**: 操作类型（view, trigger, start, stop 等）
- **resource-pattern**: 可选的资源模式（支持 glob 语法）

## 使用示例

### 基础权限（向后兼容）

```
repo:view              # 查看所有仓库
actions:trigger        # 触发所有 workflow
agent:start            # 启动所有 agent
```

### 模式匹配权限

#### 1. 测试团队权限

只允许触发测试相关的 workflow：

```
actions:trigger:test-*
```

匹配：
- ✅ `test-unit`
- ✅ `test-integration`
- ✅ `test-e2e`
- ❌ `publish-npm`
- ❌ `deploy-production`

#### 2. 发布团队权限

允许触发发布和 staging 部署：

```
actions:trigger:publish-*
actions:trigger:deploy-*-staging
```

匹配：
- ✅ `publish-npm`
- ✅ `publish-docker`
- ✅ `deploy-api-staging`
- ✅ `deploy-web-staging`
- ❌ `deploy-api-production`

#### 3. 运维团队权限

只允许生产环境操作：

```
actions:trigger:deploy-*-production
agent:start:prod-*
agent:stop:prod-*
```

匹配：
- ✅ `deploy-api-production`
- ✅ `deploy-web-production`
- ✅ agent: `prod-api`, `prod-web`
- ❌ agent: `dev-api`, `dev-web`

## Glob 语法支持

### 通配符

- `*` - 匹配任意字符（不含 `/`）
- `**` - 匹配任意字符（含 `/`）
- `?` - 匹配单个字符

### 字符集

- `[abc]` - 匹配 a、b 或 c
- `[a-z]` - 匹配 a 到 z 的任意字符

### 大括号扩展

```
test-{unit,integration}     # 匹配 test-unit 或 test-integration
deploy-{api,web}-staging    # 匹配 deploy-api-staging 或 deploy-web-staging
```

## 使用权限构建器

在权限组管理页面，点击"使用权限构建器"按钮：

1. **选择分组** - 选择权限所属的功能分组
2. **选择操作** - 选择具体的操作类型
3. **配置资源范围**
   - 所有资源：不限制具体资源
   - 模式匹配：使用快速模板或自定义 glob 模式

构建器会实时显示：
- 权限预览（完整的权限字符串）
- 匹配示例（哪些资源会被匹配）

## 权限匹配规则

当检查用户是否有权限执行某个操作时：

1. **完全匹配** - 权限字符串完全相同
2. **向后兼容** - 旧格式权限（如 `actions:trigger`）匹配所有资源
3. **Glob 匹配** - 使用 minimatch 库进行模式匹配

### 示例

用户拥有权限：`actions:trigger:test-*`

检查权限：
- `actions:trigger:test-unit` → ✅ 允许（glob 匹配）
- `actions:trigger:test-integration` → ✅ 允许（glob 匹配）
- `actions:trigger:publish-npm` → ❌ 拒绝（不匹配）

## 最佳实践

### 1. 最小权限原则

只授予完成工作所需的最小权限：

```
# ❌ 不推荐：过于宽泛
actions:trigger

# ✅ 推荐：精确控制
actions:trigger:test-*
actions:trigger:deploy-*-staging
```

### 2. 使用语义化命名

Workflow 命名应该遵循一致的模式：

```
test-unit
test-integration
test-e2e
publish-npm
publish-docker
deploy-api-staging
deploy-api-production
```

### 3. 分层权限设计

- **开发者** - `test-*`
- **发布管理员** - `test-*`, `publish-*`, `deploy-*-staging`
- **运维** - `deploy-*-production`, `prod-*`

### 4. 定期审查

定期检查权限组配置，移除不再需要的权限。

## 技术实现

### 后端

- `server/utils/permission-matcher.ts` - 权限匹配逻辑
- `server/utils/permission.ts` - 权限校验中间件
- `server/shared/permissions.ts` - 权限定义

### 前端

- `app/components/permission/PermissionBuilder.vue` - 可视化构建器
- `app/components/permission/PermissionBadge.vue` - 权限展示组件
- `app/components/admin/OrgPermissionPanel.vue` - 权限组管理

### 依赖

- `minimatch` - Glob 模式匹配库
