# 权限系统设计

## 管理员体系

系统内置两种权限级别：

| 角色 | 获取方式 | 能力 |
| ---- | -------- | ---- |
| **系统管理员** | 首次注册用户自动获得，或由已有管理员手动授权 | 访问 `/-/admin` 后台、管理所有用户、手动同步组织/团队、设置其他用户为管理员、管理所有组织的权限组和设置 |
| **普通用户** | 通过 Gitea OAuth 或飞书 OAuth 注册 | 访问自己所属组织的项目和功能，权限由所在团队的权限组决定 |

> **首次登录规则**：当 `users` 表为空时，第一个通过 Gitea OAuth 登录的用户自动成为系统管理员（`is_admin = true`），不受 Gitea 账号权限影响。

## 权限管理访问控制

权限组的管理（创建/编辑/删除权限组、为团队分配/移除权限组）仅限以下角色操作：

| 角色 | 权限管理范围 | 说明 |
| ---- | ------------ | ---- |
| **系统管理员** | 所有组织的所有权限组 | `is_admin = true` 的用户可管理任意组织的权限配置 |
| **组织 Owner/Admin** | 所属组织的所有权限组 | 通过 `requireOrgOwnerOrAdmin` 中间件校验，可创建/编辑/删除权限组 |
| **团队 Owner** | 所属团队的权限组分配 | `team_members.role = 'owner'` 的用户可管理自己所属团队的权限组绑定 |

### 权限管理判定流程

```text
请求到达 → 是系统管理员？ ──是──→ 允许
                │
               否
                │
                ▼
      是组织 Owner/Admin？ ──是──→ 允许（权限组 CRUD + 团队分配）
                │
               否
                │
                ▼
         是团队 Owner？ ──是──→ 允许（仅限所属团队的权限组分配）
                │
               否
                │
                ▼
             拒绝 403
```

> **注意**：权限组属于组织级别。系统管理员和组织 Owner/Admin 均可创建/编辑/删除权限组定义。团队 Owner 只能将已有的权限组**分配给**自己所在的团队。

## 权限组模型

### 权限组结构

```typescript
interface PermissionGroup {
  id: string;
  organization_id: string;
  type: 'default' | 'custom' | 'scene';  // 默认/自定义/场景
  name: string;
  description: string;
  permissions: string[];      // 权限 key 列表
  repository_ids?: string[];  // 可选：限定仓库范围
  created_at: Date;
  updated_at: Date;
}
```

### 权限组类型说明

| type | 说明 | 创建方式 | 可否删除 |
| ---- | ---- | -------- | -------- |
| `default` | 组织同步时自动创建的默认权限组 | 系统自动 | ❌ 禁止 |
| `custom` | 管理员手动创建的权限组 | 管理员创建 | ✅ 允许 |
| `scene` | 用户申请时自动创建/复用的场景权限组 | 审批通过时自动 | ✅ 允许 |

**场景权限组特点**：

- 用户申请权限时，描述场景名称和所需权限
- 系统按场景名称查找 `scene` 类型权限组
- 找到则复用，未找到则自动创建
- 审批通过后绑定到申请人所在团队

### 场景权限系统

场景权限提供了一套完整的权限检查和申请流程封装，简化前后端使用。

#### 架构

```text
shared/
└── scene-permissions.ts          # 场景定义 + 权限映射（前后端共享）

server/
└── utils/scene-permission.ts     # requireScenePermission() 后端工具

app/
└── composables/useScenePermission.ts  # 前端 composable
```

#### 预定义场景

在 `shared/scene-permissions.ts` 中定义：

```typescript
export const SCENE_REGISTRY = {
  "preset-workflow": {
    key: "preset-workflow",
    name: "预设工作流",
    description: "使用预设工作流触发 CI/CD 流程",
    permissions: ["actions:trigger"],
  },
  // 添加更多场景...
};
```

#### 后端使用

```typescript
import { requireScenePermission } from "~~/server/utils/scene-permission";

export default defineEventHandler(async (event) => {
  // 一行代码检查场景权限
  await requireScenePermission(event, "preset-workflow", orgId, repoId);
  
  // 权限通过，继续业务逻辑...
});
```

权限不足时自动抛出 403 错误，包含申请所需的完整信息。

#### 前端使用

```typescript
const { handlePermissionError } = useScenePermission();

const { data, error } = await useFetch('/api/xxx');

// 自动处理权限错误，跳转到申请页面
watch(error, (err) => {
  handlePermissionError(err);
}, { immediate: true });
```

#### 完整流程

1. 用户访问需要权限的页面
2. 后端 `requireScenePermission` 检查权限
3. 权限不足 → 返回 403 + 场景信息
4. 前端 `handlePermissionError` 自动跳转到 `/request-permission`
5. 用户提交申请 → 等待审批
6. 审批通过 → 跳转回原页面

### 权限定义

全局权限 key 定义（`/api/permissions/definitions`）：

| 权限 Key | 说明 | 适用范围 |
| -------- | ---- | -------- |
| `repo:view` | 查看仓库 | 项目级 |
| `repo:create` | 创建仓库 | 组织级 |
| `repo:delete` | 删除仓库 | 项目级 |
| `repo:settings` | 仓库设置 | 项目级 |
| `actions:view` | 查看 Actions | 项目级 |
| `actions:trigger` | 触发 Workflow | 项目级 |
| `agent:start` | 启动 Agent | 项目级 |
| `agent:stop` | 停止 Agent | 项目级 |
| `page:deploy` | 部署 Pages | 项目级 |
| `miniapp:manage` | 小程序管理 | 项目级 |
| `team:manage` | 团队管理 | 组织级 |
| `settings:manage` | 组织设置 | 组织级 |

### 团队权限绑定

```text
Organization
  └── Permission Group (权限组定义)
        └── Team Permission (团队绑定)
              └── Team Members (成员继承)
```

- 一个权限组可以分配给多个团队
- 一个团队可以拥有多个权限组
- 团队成员自动继承所在团队的所有权限组

## 访问控制中间件

### requireAuth

验证用户已登录：

```typescript
// server/utils/auth.ts
export async function requireAuth(event: H3Event) {
  const session = await getUserSession(event);
  if (!session.user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }
  return session.user;
}
```

### requireAdmin

验证用户是系统管理员：

```typescript
export async function requireAdmin(event: H3Event) {
  const user = await requireAuth(event);
  if (!user.is_admin) {
    throw createError({ statusCode: 403, message: "Admin access required" });
  }
  return user;
}
```

### requireOrgOwnerOrAdmin

验证用户是组织 Owner/Admin 或系统管理员：

```typescript
// server/utils/org-owner.ts
export async function requireOrgOwnerOrAdmin(event: H3Event, orgId: string) {
  const user = await requireAuth(event);
  
  // 系统管理员直接通过
  if (user.is_admin) {
    return user;
  }
  
  // 查询用户在该组织的角色
  const role = await getUserOrgRole(user.id, orgId);
  if (role !== 'owner' && role !== 'admin') {
    throw createError({ 
      statusCode: 403, 
      message: "Organization owner or admin access required" 
    });
  }
  
  return user;
}
```

### requireOrgAccess

验证用户是组织成员（管理员可跳过）：

```typescript
// server/utils/org-access.ts
export async function requireOrgAccess(event: H3Event, orgId: string) {
  const user = await requireAuth(event);
  
  // 系统管理员直接通过
  if (user.is_admin) {
    return user;
  }
  
  // 查询用户是否属于该组织
  const isMember = await isOrgMember(user.id, orgId);
  if (!isMember) {
    throw createError({ 
      statusCode: 403, 
      message: "Organization access required" 
    });
  }
  
  return user;
}
```

### requirePermission

验证用户拥有特定权限：

```typescript
export async function requirePermission(
  event: H3Event, 
  orgId: string, 
  permission: string,
  repositoryId?: string
) {
  const user = await requireAuth(event);
  
  // 系统管理员直接通过
  if (user.is_admin) {
    return user;
  }
  
  // 查询用户权限
  const hasPermission = await checkUserPermission(
    user.id, 
    orgId, 
    permission, 
    repositoryId
  );
  
  if (!hasPermission) {
    throw createError({ 
      statusCode: 403, 
      message: `Permission required: ${permission}` 
    });
  }
  
  return user;
}
```

## API 权限控制

### 组织级 API

```typescript
// /api/orgs/{orgName}/sync
export default defineEventHandler(async (event) => {
  const { orgId } = await resolveOrgId(event);
  await requireOrgOwnerOrAdmin(event, orgId);  // 仅 Owner/Admin
  // ...
});
```

### 权限组 API

```typescript
// /api/orgs/{orgName}/permissions
export default defineEventHandler(async (event) => {
  const { orgId } = await resolveOrgId(event);
  await requireOrgOwnerOrAdmin(event, orgId);  // 仅 Owner/Admin
  // ...
});
```

### 项目操作 API

```typescript
// /api/orgs/{orgName}/projects
export default defineEventHandler(async (event) => {
  const { orgId } = await resolveOrgId(event);
  await requirePermission(event, orgId, 'project:create');
  // ...
});
```

### 管理员 API

```typescript
// /api/admin/users
export default defineEventHandler(async (event) => {
  await requireAdmin(event);  // 仅系统管理员
  // ...
});
```

## 前端路由守卫

### Admin 路由守卫

```typescript
// app/middleware/admin.ts
export default defineNuxtRouteMiddleware(async (to, from) => {
  const { data: session } = await useFetch('/api/auth/session');
  
  if (!session.value?.user?.is_admin) {
    return navigateTo('/');
  }
});
```

### 组织访问守卫

```typescript
// app/middleware/org-access.ts
export default defineNuxtRouteMiddleware(async (to, from) => {
  const orgName = to.params.orgName as string;
  
  // 解析组织 ID
  const { data: org } = await useFetch(`/api/resolve/${orgName}`);
  if (!org.value) {
    return navigateTo('/');
  }
  
  // 检查访问权限
  const { data: role } = await useFetch(`/api/orgs/${org.value.id}/role`);
  if (!role.value) {
    return navigateTo('/');
  }
});
```

## 权限检查流程

### 用户权限计算

```text
1. 查询用户所属的所有团队（team_members）
2. 查询这些团队绑定的所有权限组（team_permissions）
3. 合并所有权限组的 permissions 数组
4. 去重得到用户的最终权限列表
5. 检查是否包含所需权限
```

### 仓库级权限过滤

如果权限组设置了 `repository_ids`，则该权限组的权限仅在指定仓库生效：

```typescript
async function checkUserPermission(
  userId: string,
  orgId: string,
  permission: string,
  repositoryId?: string
): Promise<boolean> {
  // 1. 获取用户的所有权限组
  const groups = await getUserPermissionGroups(userId, orgId);
  
  // 2. 过滤出包含所需权限的权限组
  const matchedGroups = groups.filter(g => 
    g.permissions.includes(permission)
  );
  
  // 3. 如果指定了仓库，检查权限组是否适用于该仓库
  if (repositoryId) {
    return matchedGroups.some(g => 
      !g.repository_ids || g.repository_ids.includes(repositoryId)
    );
  }
  
  // 4. 组织级权限直接返回
  return matchedGroups.length > 0;
}
```

## 系统预设权限组

### Admin 权限组

```json
{
  "type": "system",
  "name": "Admin",
  "description": "组织管理员，拥有所有权限",
  "permissions": [
    "repo:view",
    "repo:create",
    "repo:delete",
    "repo:settings",
    "actions:view",
    "actions:trigger",
    "agent:start",
    "agent:stop",
    "page:deploy",
    "miniapp:manage",
    "team:manage",
    "settings:manage"
  ]
}
```

### Developer 权限组

```json
{
  "type": "system",
  "name": "Developer",
  "description": "开发者，可创建项目和工作区",
  "permissions": [
    "repo:view",
    "repo:create",
    "repo:settings",
    "actions:view",
    "actions:trigger",
    "agent:start",
    "page:deploy"
  ]
}
```

### Viewer 权限组

```json
{
  "type": "system",
  "name": "Viewer",
  "description": "只读访问",
  "permissions": [
    "repo:view",
    "actions:view"
  ]
}
```

## 相关文档

- [架构概览](../overview/index.md) - 系统整体架构和用户体系
- [API 规范](./api-specification.md) - API 访问控制规范
- [数据库设计](./database-design.md) - 权限相关表结构
