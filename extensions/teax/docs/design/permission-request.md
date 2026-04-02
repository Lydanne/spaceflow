# 权限申请设计

> 基于 [通用审批流程框架](./approval-flow.md) 实现的权限申请功能

## 概述

本文档描述权限申请的具体业务实现，基于通用审批流程框架（`ApprovalFlowService` + `ApprovalStrategy`）。

### 申请场景

| 场景 | flowType | 审批人 | 通过后操作 |
| ---- | -------- | ------ | ---------- |
| **加入团队** | `permission:join_team` | 团队 Owner → 组织 Owner/Admin | 创建 `team_members` 记录 |
| **申请权限组** | `permission:request_group` | 组织 Owner/Admin | 创建 `team_permissions` 记录 |
| **申请仓库访问** | `permission:request_repo` | 组织 Owner/Admin | 更新权限组的 `repository_ids` |

---

## 数据模型

权限申请使用通用的 `approval_flows` 表，通过 `flow_type` 和 `payload` 区分：

```typescript
// flow_type = 'permission:join_team'
interface JoinTeamPayload {
  targetTeamId: string;
}

// flow_type = 'permission:request_group'
interface RequestPermissionPayload {
  targetPermissionGroupId: string;
  teamId: string; // 申请人所在的团队
}

// flow_type = 'permission:request_repo'
interface RequestRepoAccessPayload {
  targetRepositoryId: string;
  teamId: string;
}
```

### 与通用表的关系

```text
approval_flows (通用审批表)
  ├─ flow_type = 'permission:join_team' | 'permission:request_group' | 'permission:request_repo'
  ├─ payload = { targetTeamId } | { targetPermissionGroupId, teamId } | { targetRepositoryId, teamId }
  ├─ organization_id → organizations.id
  ├─ requester_id → users.id
  └─ approver_id → users.id
```

---

## 策略实现

### 加入团队策略

```typescript
// server/services/approval-flow/strategies/permission-join-team.ts

import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import type { ApprovalStrategy } from "../types";
import type { ApprovalFlow } from "~~/server/db/schema/approval-flow";

interface JoinTeamPayload {
  targetTeamId: string;
}

export const joinTeamStrategy: ApprovalStrategy<JoinTeamPayload> = {
  flowType: "permission:join_team",

  async validateRequest(event, payload, organizationId) {
    const db = useDB();
    const user = event.context.user;

    // 1. 检查团队是否存在
    const [team] = await db
      .select()
      .from(schema.teams)
      .where(eq(schema.teams.id, payload.targetTeamId))
      .limit(1);

    if (!team) {
      throw createError({ statusCode: 404, message: "Team not found" });
    }

    // 2. 检查用户是否已在团队中
    const [existing] = await db
      .select()
      .from(schema.teamMembers)
      .where(
        and(
          eq(schema.teamMembers.team_id, payload.targetTeamId),
          eq(schema.teamMembers.user_id, user.id),
        ),
      )
      .limit(1);

    if (existing) {
      throw createError({ statusCode: 400, message: "Already a team member" });
    }

    // 3. 检查是否有重复的待处理申请
    const [pendingFlow] = await db
      .select()
      .from(schema.approvalFlows)
      .where(
        and(
          eq(schema.approvalFlows.flow_type, "permission:join_team"),
          eq(schema.approvalFlows.requester_id, user.id),
          eq(schema.approvalFlows.status, "pending"),
        ),
      )
      .limit(1);

    if (pendingFlow) {
      throw createError({ statusCode: 400, message: "Duplicate pending request" });
    }
  },

  async buildTitle(payload) {
    const db = useDB();
    const [team] = await db
      .select()
      .from(schema.teams)
      .where(eq(schema.teams.id, payload.targetTeamId))
      .limit(1);

    return `申请加入团队「${team?.name || "未知"}」`;
  },

  async findApprovers(organizationId, payload) {
    const db = useDB();
    const approverOpenIds: string[] = [];

    // 1. 团队 Owner
    const teamOwners = await db
      .select({ openId: schema.users.feishu_open_id })
      .from(schema.teamMembers)
      .innerJoin(schema.users, eq(schema.teamMembers.user_id, schema.users.id))
      .where(
        and(
          eq(schema.teamMembers.team_id, payload.targetTeamId),
          eq(schema.teamMembers.role, "owner"),
        ),
      );

    approverOpenIds.push(
      ...teamOwners.map((o) => o.openId).filter((id): id is string => !!id),
    );

    // 2. 组织 Owner/Admin（如果团队 Owner 不足）
    if (organizationId && approverOpenIds.length === 0) {
      const orgAdmins = await db
        .select({ openId: schema.users.feishu_open_id })
        .from(schema.teamMembers)
        .innerJoin(schema.teams, eq(schema.teamMembers.team_id, schema.teams.id))
        .innerJoin(schema.users, eq(schema.teamMembers.user_id, schema.users.id))
        .where(
          and(
            eq(schema.teams.organization_id, organizationId),
            eq(schema.teamMembers.role, "owner"),
          ),
        );

      approverOpenIds.push(
        ...orgAdmins.map((o) => o.openId).filter((id): id is string => !!id),
      );
    }

    return [...new Set(approverOpenIds)];
  },

  async buildCardFields(flow, payload) {
    const db = useDB();

    const [team] = await db
      .select()
      .from(schema.teams)
      .where(eq(schema.teams.id, payload.targetTeamId))
      .limit(1);

    const [requester] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, flow.requester_id))
      .limit(1);

    return [
      { label: "申请人", value: requester?.gitea_username || "未知" },
      { label: "目标团队", value: team?.name || "未知" },
      { label: "申请理由", value: flow.reason || "无" },
    ];
  },

  async onApproved(flow, payload, approverId) {
    const db = useDB();

    // 添加用户到团队
    await db.insert(schema.teamMembers).values({
      team_id: payload.targetTeamId,
      user_id: flow.requester_id,
      role: "member",
    });
  },
};
```

### 申请权限组策略

```typescript
// server/services/approval-flow/strategies/permission-request-group.ts

interface RequestPermissionPayload {
  targetPermissionGroupId: string;
  teamId: string;
}

export const requestPermissionStrategy: ApprovalStrategy<RequestPermissionPayload> = {
  flowType: "permission:request_group",

  async validateRequest(event, payload, organizationId) {
    const db = useDB();
    const user = event.context.user;

    // 1. 检查权限组存在且属于同一组织
    const [group] = await db
      .select()
      .from(schema.permissionGroups)
      .where(eq(schema.permissionGroups.id, payload.targetPermissionGroupId))
      .limit(1);

    if (!group || group.organization_id !== organizationId) {
      throw createError({ statusCode: 404, message: "Permission group not found" });
    }

    // 2. 检查用户所在团队
    const [membership] = await db
      .select()
      .from(schema.teamMembers)
      .where(
        and(
          eq(schema.teamMembers.team_id, payload.teamId),
          eq(schema.teamMembers.user_id, user.id),
        ),
      )
      .limit(1);

    if (!membership) {
      throw createError({ statusCode: 400, message: "Not a member of the specified team" });
    }

    // 3. 检查团队是否已绑定该权限组
    const [existingBinding] = await db
      .select()
      .from(schema.teamPermissions)
      .where(
        and(
          eq(schema.teamPermissions.team_id, payload.teamId),
          eq(schema.teamPermissions.permission_group_id, payload.targetPermissionGroupId),
        ),
      )
      .limit(1);

    if (existingBinding) {
      throw createError({ statusCode: 400, message: "Team already has this permission group" });
    }
  },

  async buildTitle(payload) {
    const db = useDB();
    const [group] = await db
      .select()
      .from(schema.permissionGroups)
      .where(eq(schema.permissionGroups.id, payload.targetPermissionGroupId))
      .limit(1);

    return `申请权限组「${group?.name || "未知"}」`;
  },

  async findApprovers(organizationId) {
    // 返回组织 Owner/Admin 的飞书 open_id
    const db = useDB();
    const orgAdmins = await db
      .select({ openId: schema.users.feishu_open_id })
      .from(schema.teamMembers)
      .innerJoin(schema.teams, eq(schema.teamMembers.team_id, schema.teams.id))
      .innerJoin(schema.users, eq(schema.teamMembers.user_id, schema.users.id))
      .where(
        and(
          eq(schema.teams.organization_id, organizationId!),
          eq(schema.teamMembers.role, "owner"),
        ),
      );

    return orgAdmins.map((o) => o.openId).filter((id): id is string => !!id);
  },

  async buildCardFields(flow, payload) {
    const db = useDB();

    const [group] = await db
      .select()
      .from(schema.permissionGroups)
      .where(eq(schema.permissionGroups.id, payload.targetPermissionGroupId))
      .limit(1);

    const [requester] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, flow.requester_id))
      .limit(1);

    const [team] = await db
      .select()
      .from(schema.teams)
      .where(eq(schema.teams.id, payload.teamId))
      .limit(1);

    return [
      { label: "申请人", value: requester?.gitea_username || "未知" },
      { label: "所属团队", value: team?.name || "未知" },
      { label: "目标权限组", value: group?.name || "未知" },
      { label: "包含权限", value: (group?.permissions || []).join(", ") || "无" },
      { label: "申请理由", value: flow.reason || "无" },
    ];
  },

  async onApproved(flow, payload, approverId) {
    const db = useDB();

    // 为团队绑定权限组
    await db.insert(schema.teamPermissions).values({
      team_id: payload.teamId,
      permission_group_id: payload.targetPermissionGroupId,
    });
  },
};
```

### 申请仓库访问策略

```typescript
// server/services/approval-flow/strategies/permission-request-repo.ts

interface RequestRepoAccessPayload {
  targetRepositoryId: string;
  teamId: string;
}

export const requestRepoAccessStrategy: ApprovalStrategy<RequestRepoAccessPayload> = {
  flowType: "permission:request_repo",

  async validateRequest(event, payload, organizationId) {
    // 校验仓库存在且属于同一组织
    // 校验用户所在团队
    // 校验团队是否已有该仓库访问权限
  },

  async buildTitle(payload) {
    const db = useDB();
    const [repo] = await db
      .select()
      .from(schema.repositories)
      .where(eq(schema.repositories.id, payload.targetRepositoryId))
      .limit(1);

    return `申请访问仓库「${repo?.full_name || "未知"}」`;
  },

  async findApprovers(organizationId) {
    // 返回组织 Owner/Admin 的飞书 open_id
    return [];
  },

  async buildCardFields(flow, payload) {
    return [];
  },

  async onApproved(flow, payload, approverId) {
    const db = useDB();

    // 查找团队的权限组，添加仓库到 repository_ids
    // 或创建新的权限组并绑定
    const [teamPerm] = await db
      .select()
      .from(schema.teamPermissions)
      .innerJoin(
        schema.permissionGroups,
        eq(schema.teamPermissions.permission_group_id, schema.permissionGroups.id),
      )
      .where(eq(schema.teamPermissions.team_id, payload.teamId))
      .limit(1);

    if (teamPerm) {
      // 更新现有权限组的 repository_ids
      const currentIds = (teamPerm.permission_groups.repository_ids as string[]) || [];
      await db
        .update(schema.permissionGroups)
        .set({
          repository_ids: [...currentIds, payload.targetRepositoryId],
        })
        .where(eq(schema.permissionGroups.id, teamPerm.permission_groups.id));
    } else {
      // 创建新权限组并绑定
      const [newGroup] = await db
        .insert(schema.permissionGroups)
        .values({
          organization_id: flow.organization_id!,
          name: `${payload.teamId}-repo-access`,
          type: "custom",
          permissions: ["repo:view"],
          repository_ids: [payload.targetRepositoryId],
        })
        .returning();

      await db.insert(schema.teamPermissions).values({
        team_id: payload.teamId,
        permission_group_id: newGroup.id,
      });
    }
  },
};
```

---

## API 设计

权限申请使用通用审批 API，同时提供业务快捷 API：

### 业务快捷 API

```http
# 创建权限申请（内部调用 ApprovalFlowService.create）
POST /api/orgs/{orgName}/permission-requests
{
  "type": "join_team" | "request_group" | "request_repo",
  "targetTeamId": "...",           // type=join_team
  "targetPermissionGroupId": "...", // type=request_group
  "targetRepositoryId": "...",      // type=request_repo
  "teamId": "...",                  // type=request_group|request_repo 时必填
  "reason": "申请理由"
}
```

### 通用审批 API

```http
# 查询我的申请（过滤 flowType 前缀为 permission:*）
GET /api/user/approval-flows?flowType=permission:*&status=pending

# 取消申请
DELETE /api/user/approval-flows/{flowId}

# 查询待审批列表
GET /api/orgs/{orgName}/approval-flows/pending?flowType=permission:*

# 审批操作
POST /api/approval-flows/{flowId}/approve
POST /api/approval-flows/{flowId}/reject
```

---

## 前端页面

### 路由结构

```text
/user/approval-flows?type=permission    — 我的权限申请列表
/org/{orgName}/settings/approvals       — 组织待审批列表（包含所有类型）
/-/admin/approval-flows                 — 全局审批管理
```

### 申请入口

| 位置 | 触发条件 | 按钮文案 |
| ---- | -------- | -------- |
| 团队列表页 | 用户不在该团队 | 「申请加入」 |
| 权限组列表页 | 用户所在团队未绑定该权限组 | 「申请权限」 |
| 仓库详情页 | 用户无访问权限 | 「申请访问」 |

---

## 策略注册

在 Nitro 插件中注册权限申请策略：

```typescript
// server/plugins/approval-strategies.ts

import { registerStrategy } from "~~/server/services/approval-flow/registry";
import { joinTeamStrategy } from "~~/server/services/approval-flow/strategies/permission-join-team";
import { requestPermissionStrategy } from "~~/server/services/approval-flow/strategies/permission-request-group";
import { requestRepoAccessStrategy } from "~~/server/services/approval-flow/strategies/permission-request-repo";

export default defineNitroPlugin(() => {
  registerStrategy(joinTeamStrategy);
  registerStrategy(requestPermissionStrategy);
  registerStrategy(requestRepoAccessStrategy);

  console.log("[ApprovalFlow] Permission strategies registered");
});
```

---

## 实现计划

> 依赖 [通用审批流程框架](./approval-flow.md) 先完成

### Phase 1：策略实现

- [ ] 实现 `joinTeamStrategy`
- [ ] 实现 `requestPermissionStrategy`
- [ ] 实现 `requestRepoAccessStrategy`
- [ ] 在 `approval-strategies.ts` 插件中注册

### Phase 2：业务 API

- [ ] 实现 `/api/orgs/{orgName}/permission-requests` 快捷 API
- [ ] 添加 DTO 校验

### Phase 3：前端页面

- [ ] 申请入口按钮组件
- [ ] 我的申请列表（复用通用审批列表，过滤 flowType）
- [ ] 组织待审批 Tab

---

## 相关文档

- [通用审批流程框架](./approval-flow.md) — 核心框架设计
- [权限系统设计](./permission-system.md) — 权限组、团队权限绑定
- [飞书集成](../overview/feishu-integration.md) — 消息通知
- [API 规范](./api-specification.md) — 路由设计规范
