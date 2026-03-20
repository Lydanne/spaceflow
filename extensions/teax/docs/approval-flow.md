# 通用审批流程框架设计

> 申请 → 审批 → 同意/拒绝 → 通知 的通用抽象

## 设计目标

将「申请 → 审批 → 通知」这一通用流程抽象为可复用的框架，支持多种业务场景：

| 场景 | 申请内容 | 审批后操作 |
| ---- | -------- | ---------- |
| **权限申请** | 加入团队、申请权限组、申请仓库访问 | 创建 team_members / team_permissions |
| **部署审批** | 生产环境部署 | 触发 Gitea workflow dispatch |
| **配置变更** | 修改敏感配置 | 更新配置项 |
| **资源申请** | 申请工作区、申请更多配额 | 创建资源 |

---

## 核心架构

### 设计模式

采用 **策略模式 + 事件驱动**：

```text
┌─────────────────────────────────────────────────────────────────┐
│                     ApprovalFlowService                         │
│                     (通用审批流程引擎)                            │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   create()  │  │  approve()  │  │  reject()   │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         ▼                ▼                ▼                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                  ApprovalStrategy                           ││
│  │                  (业务策略接口)                              ││
│  │                                                             ││
│  │  • buildTitle()        — 生成申请标题                        ││
│  │  • findApprovers()     — 查找审批人                          ││
│  │  • validateRequest()   — 校验申请合法性                       ││
│  │  • onApproved()        — 审批通过后的业务操作                  ││
│  │  • onRejected()        — 审批拒绝后的业务操作                  ││
│  │  • buildCardFields()   — 构建卡片展示字段                     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                  具体策略实现                                ││
│  │                                                             ││
│  │  ┌──────────────────┐  ┌──────────────────┐                ││
│  │  │ PermissionRequest │  │ DeployApproval   │                ││
│  │  │ Strategy          │  │ Strategy         │                ││
│  │  └──────────────────┘  └──────────────────┘                ││
│  │                                                             ││
│  │  ┌──────────────────┐  ┌──────────────────┐                ││
│  │  │ ConfigChange     │  │ ResourceRequest  │                ││
│  │  │ Strategy         │  │ Strategy         │                ││
│  │  └──────────────────┘  └──────────────────┘                ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 流程图

```text
用户                 ApprovalFlowService              Strategy              飞书
 │                          │                           │                    │
 │  1. 提交申请              │                           │                    │
 │ ────────────────────────>│                           │                    │
 │                          │                           │                    │
 │                          │  2. validateRequest()     │                    │
 │                          │ ─────────────────────────>│                    │
 │                          │                           │                    │
 │                          │  3. buildTitle()          │                    │
 │                          │ ─────────────────────────>│                    │
 │                          │                           │                    │
 │                          │  4. findApprovers()       │                    │
 │                          │ ─────────────────────────>│                    │
 │                          │                           │                    │
 │                          │  5. 创建 approval_flows 记录                    │
 │                          │  6. buildCardFields()     │                    │
 │                          │ ─────────────────────────>│                    │
 │                          │                           │                    │
 │                          │  7. 发送审批卡片           │                    │
 │                          │ ──────────────────────────────────────────────>│
 │                          │                           │                    │
 │                          │                           │  8. 审批人操作      │
 │                          │<──────────────────────────────────────────────│
 │                          │                           │                    │
 │                          │  9. onApproved/onRejected │                    │
 │                          │ ─────────────────────────>│                    │
 │                          │                           │                    │
 │                          │ 10. 更新状态 + 审计日志                         │
 │                          │                           │                    │
 │ 11. 收到结果通知          │                           │                    │
 │<────────────────────────│                           │                    │
```

---

## 数据模型

### approval_flows 表

统一的审批流程表，替代多个独立的申请表：

```typescript
// server/db/schema/approval-flow.ts

import { pgTable, uuid, varchar, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./user";
import { organizations } from "./organization";
import { baseColumns } from "./base";

export const approvalFlows = pgTable(
  "approval_flows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    
    // 所属组织（可选，某些全局审批可能没有组织）
    organization_id: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
    
    // 申请人
    requester_id: uuid("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // ─── 审批类型 ───────────────────────────────────────────
    // 用于路由到对应的 Strategy
    flow_type: varchar("flow_type", { length: 100 }).notNull(),
    // 例如: 'permission:join_team', 'permission:request_group', 
    //       'deploy:production', 'config:sensitive', 'resource:workspace'

    // ─── 状态 ───────────────────────────────────────────────
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    // 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired'

    // ─── 申请信息 ───────────────────────────────────────────
    title: varchar("title", { length: 500 }).notNull(),
    reason: text("reason"),
    
    // 业务数据（JSON，由 Strategy 定义结构）
    payload: jsonb("payload").notNull().default({}),
    // 例如权限申请: { targetTeamId: "...", targetPermissionGroupId: "..." }
    // 例如部署审批: { branch: "main", workflow: "deploy.yml", commitSha: "..." }

    // ─── 审批信息 ───────────────────────────────────────────
    approver_id: uuid("approver_id").references(() => users.id),
    approver_comment: text("approver_comment"),
    approved_at: timestamp("approved_at", { withTimezone: true }),

    // ─── 飞书集成 ───────────────────────────────────────────
    feishu_message_id: varchar("feishu_message_id", { length: 255 }),

    // ─── 过期控制 ───────────────────────────────────────────
    expires_at: timestamp("expires_at", { withTimezone: true }),

    ...baseColumns(),
  },
  (table) => [
    index("idx_approval_flow_org").on(table.organization_id),
    index("idx_approval_flow_requester").on(table.requester_id),
    index("idx_approval_flow_type").on(table.flow_type),
    index("idx_approval_flow_status").on(table.status),
    index("idx_approval_flow_expires").on(table.expires_at),
  ],
);

// 类型定义
export type ApprovalFlow = typeof approvalFlows.$inferSelect;
export type NewApprovalFlow = typeof approvalFlows.$inferInsert;
```

### 与现有表的关系

```text
approval_flows (新表，统一审批)
  ├─ organization_id → organizations.id
  ├─ requester_id → users.id
  └─ approver_id → users.id

旧表处理：
  - approval_requests (部署审批) → 迁移到 approval_flows (flow_type='deploy:*')
  - permission_requests (权限申请) → 不再需要，直接用 approval_flows
```

---

## 策略接口

### ApprovalStrategy 接口

```typescript
// server/services/approval-flow/types.ts

import type { H3Event } from "h3";
import type { ApprovalFlow } from "~~/server/db/schema/approval-flow";

/**
 * 审批策略接口
 * 每种审批类型实现一个 Strategy
 */
export interface ApprovalStrategy<TPayload = Record<string, unknown>> {
  /**
   * 流程类型标识
   * 例如: 'permission:join_team', 'deploy:production'
   */
  readonly flowType: string;

  /**
   * 校验申请数据
   * @throws 如果校验失败抛出错误
   */
  validateRequest(
    event: H3Event,
    payload: TPayload,
    organizationId?: string,
  ): Promise<void>;

  /**
   * 生成申请标题
   */
  buildTitle(payload: TPayload): Promise<string>;

  /**
   * 查找审批人列表
   * @returns 审批人的飞书 open_id 数组
   */
  findApprovers(
    organizationId: string | undefined,
    payload: TPayload,
  ): Promise<string[]>;

  /**
   * 构建卡片展示字段
   * 用于飞书审批卡片的内容展示
   */
  buildCardFields(
    flow: ApprovalFlow,
    payload: TPayload,
  ): Promise<Array<{ label: string; value: string }>>;

  /**
   * 审批通过后的业务操作
   * 例如：创建团队成员、触发部署等
   */
  onApproved(
    flow: ApprovalFlow,
    payload: TPayload,
    approverId: string,
  ): Promise<void>;

  /**
   * 审批拒绝后的业务操作（可选）
   * 默认不做任何操作
   */
  onRejected?(
    flow: ApprovalFlow,
    payload: TPayload,
    approverId: string,
    comment?: string,
  ): Promise<void>;

  /**
   * 申请过期后的业务操作（可选）
   */
  onExpired?(flow: ApprovalFlow, payload: TPayload): Promise<void>;

  /**
   * 获取申请人通知内容（可选）
   * 用于审批完成后通知申请人
   */
  getRequesterNotification?(
    flow: ApprovalFlow,
    payload: TPayload,
    result: "approved" | "rejected",
  ): Promise<{
    title: string;
    fields: Array<{ label: string; value: string }>;
  }>;
}
```

### 策略注册表

```typescript
// server/services/approval-flow/registry.ts

import type { ApprovalStrategy } from "./types";

const strategyRegistry = new Map<string, ApprovalStrategy>();

/**
 * 注册审批策略
 */
export function registerStrategy(strategy: ApprovalStrategy): void {
  if (strategyRegistry.has(strategy.flowType)) {
    throw new Error(`Strategy for flow type "${strategy.flowType}" already registered`);
  }
  strategyRegistry.set(strategy.flowType, strategy);
}

/**
 * 获取审批策略
 */
export function getStrategy(flowType: string): ApprovalStrategy {
  const strategy = strategyRegistry.get(flowType);
  if (!strategy) {
    throw new Error(`No strategy registered for flow type "${flowType}"`);
  }
  return strategy;
}

/**
 * 获取所有已注册的流程类型
 */
export function getRegisteredFlowTypes(): string[] {
  return Array.from(strategyRegistry.keys());
}
```

---

## 核心服务

### ApprovalFlowService

```typescript
// server/services/approval-flow/service.ts

import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { getStrategy } from "./registry";
import { FeishuCardBuilder } from "~~/server/utils/feishu-card-builder";
import { sendFeishuCardMessage } from "~~/server/utils/feishu-sdk";
import { writeAuditLog } from "~~/server/utils/audit";
import type { H3Event } from "h3";
import type { ApprovalFlow } from "~~/server/db/schema/approval-flow";

const DEFAULT_EXPIRE_DAYS = 7;

export class ApprovalFlowService {
  /**
   * 创建审批流程
   */
  static async create<TPayload extends Record<string, unknown>>(
    event: H3Event,
    params: {
      flowType: string;
      organizationId?: string;
      requesterId: string;
      payload: TPayload;
      reason?: string;
      expireDays?: number;
    },
  ): Promise<ApprovalFlow> {
    const db = useDB();
    const strategy = getStrategy(params.flowType);

    // 1. 校验申请
    await strategy.validateRequest(event, params.payload, params.organizationId);

    // 2. 生成标题
    const title = await strategy.buildTitle(params.payload);

    // 3. 查找审批人
    const approverOpenIds = await strategy.findApprovers(
      params.organizationId,
      params.payload,
    );

    if (approverOpenIds.length === 0) {
      throw createError({
        statusCode: 400,
        message: "No approvers found for this request",
      });
    }

    // 4. 计算过期时间
    const expireDays = params.expireDays ?? DEFAULT_EXPIRE_DAYS;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expireDays);

    // 5. 创建记录
    const [flow] = await db
      .insert(schema.approvalFlows)
      .values({
        organization_id: params.organizationId,
        requester_id: params.requesterId,
        flow_type: params.flowType,
        title,
        reason: params.reason,
        payload: params.payload,
        expires_at: expiresAt,
      })
      .returning();

    // 6. 发送审批卡片
    await this.sendApprovalCard(flow, approverOpenIds, strategy);

    // 7. 写入审计日志
    await writeAuditLog(event, {
      action: "approval_flow.create",
      resourceType: "approval_flow",
      resourceId: flow.id,
      organizationId: params.organizationId,
      details: { flowType: params.flowType, payload: params.payload },
    });

    return flow;
  }

  /**
   * 审批通过
   */
  static async approve(
    event: H3Event,
    flowId: string,
    approverId: string,
    comment?: string,
  ): Promise<ApprovalFlow> {
    const db = useDB();

    // 1. 获取流程记录
    const [flow] = await db
      .select()
      .from(schema.approvalFlows)
      .where(eq(schema.approvalFlows.id, flowId))
      .limit(1);

    if (!flow) {
      throw createError({ statusCode: 404, message: "Approval flow not found" });
    }

    if (flow.status !== "pending") {
      throw createError({ statusCode: 400, message: "Flow is not pending" });
    }

    // 2. 检查是否过期
    if (flow.expires_at && new Date() > flow.expires_at) {
      throw createError({ statusCode: 400, message: "Flow has expired" });
    }

    const strategy = getStrategy(flow.flow_type);

    // 3. 执行业务操作
    await strategy.onApproved(flow, flow.payload as Record<string, unknown>, approverId);

    // 4. 更新状态
    const [updatedFlow] = await db
      .update(schema.approvalFlows)
      .set({
        status: "approved",
        approver_id: approverId,
        approver_comment: comment,
        approved_at: new Date(),
      })
      .where(eq(schema.approvalFlows.id, flowId))
      .returning();

    // 5. 通知申请人
    await this.notifyRequester(updatedFlow, "approved", strategy);

    // 6. 写入审计日志
    await writeAuditLog(event, {
      action: "approval_flow.approve",
      resourceType: "approval_flow",
      resourceId: flowId,
      organizationId: flow.organization_id ?? undefined,
      details: { comment },
    });

    return updatedFlow;
  }

  /**
   * 审批拒绝
   */
  static async reject(
    event: H3Event,
    flowId: string,
    approverId: string,
    comment?: string,
  ): Promise<ApprovalFlow> {
    const db = useDB();

    const [flow] = await db
      .select()
      .from(schema.approvalFlows)
      .where(eq(schema.approvalFlows.id, flowId))
      .limit(1);

    if (!flow) {
      throw createError({ statusCode: 404, message: "Approval flow not found" });
    }

    if (flow.status !== "pending") {
      throw createError({ statusCode: 400, message: "Flow is not pending" });
    }

    const strategy = getStrategy(flow.flow_type);

    // 执行拒绝后的业务操作（如果有）
    if (strategy.onRejected) {
      await strategy.onRejected(
        flow,
        flow.payload as Record<string, unknown>,
        approverId,
        comment,
      );
    }

    // 更新状态
    const [updatedFlow] = await db
      .update(schema.approvalFlows)
      .set({
        status: "rejected",
        approver_id: approverId,
        approver_comment: comment,
        approved_at: new Date(),
      })
      .where(eq(schema.approvalFlows.id, flowId))
      .returning();

    // 通知申请人
    await this.notifyRequester(updatedFlow, "rejected", strategy);

    // 写入审计日志
    await writeAuditLog(event, {
      action: "approval_flow.reject",
      resourceType: "approval_flow",
      resourceId: flowId,
      organizationId: flow.organization_id ?? undefined,
      details: { comment },
    });

    return updatedFlow;
  }

  /**
   * 取消申请（仅申请人可操作）
   */
  static async cancel(
    event: H3Event,
    flowId: string,
    requesterId: string,
  ): Promise<ApprovalFlow> {
    const db = useDB();

    const [flow] = await db
      .select()
      .from(schema.approvalFlows)
      .where(
        and(
          eq(schema.approvalFlows.id, flowId),
          eq(schema.approvalFlows.requester_id, requesterId),
          eq(schema.approvalFlows.status, "pending"),
        ),
      )
      .limit(1);

    if (!flow) {
      throw createError({
        statusCode: 404,
        message: "Approval flow not found or not cancellable",
      });
    }

    const [updatedFlow] = await db
      .update(schema.approvalFlows)
      .set({ status: "cancelled" })
      .where(eq(schema.approvalFlows.id, flowId))
      .returning();

    await writeAuditLog(event, {
      action: "approval_flow.cancel",
      resourceType: "approval_flow",
      resourceId: flowId,
      organizationId: flow.organization_id ?? undefined,
    });

    return updatedFlow;
  }

  /**
   * 发送审批卡片
   */
  private static async sendApprovalCard(
    flow: ApprovalFlow,
    approverOpenIds: string[],
    strategy: ApprovalStrategy,
  ): Promise<void> {
    const fields = await strategy.buildCardFields(
      flow,
      flow.payload as Record<string, unknown>,
    );

    const card = new FeishuCardBuilder({
      title: `📋 ${flow.title}`,
      theme: "blue",
    })
      .addFields(fields)
      .addDivider()
      .addButtons([
        {
          text: "✅ 通过",
          value: `approval_flow:approve:${flow.id}`,
          type: "primary",
        },
        {
          text: "❌ 拒绝",
          value: `approval_flow:reject:${flow.id}`,
          type: "danger",
        },
      ])
      .addConfirm({
        title: "确认操作",
        text: "确定要执行此操作吗？",
      })
      .build();

    // 私信发送给每个审批人
    const db = useDB();
    for (const openId of approverOpenIds) {
      const result = await sendFeishuCardMessage(openId, card.card, "open_id");
      
      // 记录第一个成功发送的 message_id
      if (result.message_id && !flow.feishu_message_id) {
        await db
          .update(schema.approvalFlows)
          .set({ feishu_message_id: result.message_id })
          .where(eq(schema.approvalFlows.id, flow.id));
      }
    }
  }

  /**
   * 通知申请人
   */
  private static async notifyRequester(
    flow: ApprovalFlow,
    result: "approved" | "rejected",
    strategy: ApprovalStrategy,
  ): Promise<void> {
    // 获取申请人的飞书 open_id
    const db = useDB();
    const [requester] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, flow.requester_id))
      .limit(1);

    if (!requester?.feishu_open_id) return;

    const isApproved = result === "approved";

    // 获取自定义通知内容（如果策略提供）
    let title = isApproved ? "✅ 申请已通过" : "❌ 申请已拒绝";
    let fields: Array<{ label: string; value: string }> = [
      { label: "申请内容", value: flow.title },
    ];

    if (strategy.getRequesterNotification) {
      const notification = await strategy.getRequesterNotification(
        flow,
        flow.payload as Record<string, unknown>,
        result,
      );
      title = notification.title;
      fields = notification.fields;
    }

    if (flow.approver_comment) {
      fields.push({ label: "审批备注", value: flow.approver_comment });
    }

    const card = new FeishuCardBuilder({
      title,
      theme: isApproved ? "green" : "red",
    })
      .addFields(fields)
      .build();

    await sendFeishuCardMessage(requester.feishu_open_id, card.card, "open_id");
  }
}
```

---

## 策略实现示例

### 权限申请策略

```typescript
// server/services/approval-flow/strategies/permission-request.ts

import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import type { ApprovalStrategy } from "../types";
import type { ApprovalFlow } from "~~/server/db/schema/approval-flow";

// Payload 类型定义
interface JoinTeamPayload {
  targetTeamId: string;
}

interface RequestPermissionPayload {
  targetPermissionGroupId: string;
  teamId: string; // 申请人所在的团队
}

interface RequestRepoAccessPayload {
  targetRepositoryId: string;
  teamId: string;
}

type PermissionRequestPayload =
  | JoinTeamPayload
  | RequestPermissionPayload
  | RequestRepoAccessPayload;

/**
 * 加入团队策略
 */
export const joinTeamStrategy: ApprovalStrategy<JoinTeamPayload> = {
  flowType: "permission:join_team",

  async validateRequest(event, payload, organizationId) {
    const db = useDB();
    const user = event.context.user;

    // 检查团队是否存在
    const [team] = await db
      .select()
      .from(schema.teams)
      .where(eq(schema.teams.id, payload.targetTeamId))
      .limit(1);

    if (!team) {
      throw createError({ statusCode: 404, message: "Team not found" });
    }

    // 检查用户是否已在团队中
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

    // 检查是否有重复的待处理申请
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

    // 2. 组织 Owner/Admin
    if (organizationId) {
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

/**
 * 申请权限组策略
 */
export const requestPermissionStrategy: ApprovalStrategy<RequestPermissionPayload> = {
  flowType: "permission:request_group",

  async validateRequest(event, payload, organizationId) {
    // 校验权限组存在且属于同一组织
    // 校验用户所在团队未绑定该权限组
    // 校验无重复待处理申请
    // ... 实现略
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
    // ... 实现略
    return [];
  },

  async buildCardFields(flow, payload) {
    // ... 实现略
    return [];
  },

  async onApproved(flow, payload, approverId) {
    const db = useDB();

    // 为用户所在团队绑定权限组
    await db.insert(schema.teamPermissions).values({
      team_id: payload.teamId,
      permission_group_id: payload.targetPermissionGroupId,
    });
  },
};
```

### 部署审批策略

```typescript
// server/services/approval-flow/strategies/deploy-approval.ts

import type { ApprovalStrategy } from "../types";
import { triggerWorkflowDispatch } from "~~/server/utils/gitea";

interface DeployPayload {
  repositoryId: string;
  owner: string;
  repo: string;
  branch: string;
  workflow: string;
  commitSha?: string;
}

export const deployApprovalStrategy: ApprovalStrategy<DeployPayload> = {
  flowType: "deploy:production",

  async validateRequest(event, payload) {
    // 校验仓库存在
    // 校验用户有部署权限
    // 校验无重复待处理申请
  },

  async buildTitle(payload) {
    return `部署 ${payload.owner}/${payload.repo} 到生产环境`;
  },

  async findApprovers(organizationId, payload) {
    // 返回仓库管理员或组织 Owner 的飞书 open_id
    return [];
  },

  async buildCardFields(flow, payload) {
    return [
      { label: "仓库", value: `${payload.owner}/${payload.repo}` },
      { label: "分支", value: payload.branch },
      { label: "Workflow", value: payload.workflow },
      ...(payload.commitSha ? [{ label: "Commit", value: payload.commitSha.slice(0, 7) }] : []),
    ];
  },

  async onApproved(flow, payload, approverId) {
    // 触发 Gitea workflow dispatch
    await triggerWorkflowDispatch({
      owner: payload.owner,
      repo: payload.repo,
      workflow: payload.workflow,
      ref: payload.branch,
    });
  },
};
```

---

## 飞书卡片回调处理

在 `server/api/webhooks/feishu.post.ts` 中统一处理：

```typescript
// 在 handleCardAction 函数中添加

async function handleCardAction(action: FeishuCardAction) {
  const actionValue = action.value;
  
  // 统一审批流程处理
  if (typeof actionValue === "string" && actionValue.startsWith("approval_flow:")) {
    const [, operation, flowId] = actionValue.split(":");
    const operatorOpenId = action.operator.open_id;

    // 通过 open_id 查找用户
    const [operator] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.feishu_open_id, operatorOpenId))
      .limit(1);

    if (!operator) {
      return { toast: { type: "error", content: "用户未绑定" } };
    }

    // 创建模拟 event 用于审计日志
    const mockEvent = { context: { user: operator } } as H3Event;

    if (operation === "approve") {
      await ApprovalFlowService.approve(mockEvent, flowId, operator.id);
      return { toast: { type: "success", content: "已通过" } };
    }

    if (operation === "reject") {
      await ApprovalFlowService.reject(mockEvent, flowId, operator.id);
      return { toast: { type: "info", content: "已拒绝" } };
    }
  }

  // ... 其他卡片类型处理
}
```

---

## API 设计

### 通用审批 API

```http
# 创建审批流程
POST /api/approval-flows
{
  "flowType": "permission:join_team",
  "organizationId": "...",
  "payload": { "targetTeamId": "..." },
  "reason": "申请理由"
}

# 查询我的申请
GET /api/user/approval-flows?status=pending&page=1&limit=20

# 取消申请
DELETE /api/user/approval-flows/{flowId}

# 查询待审批列表（组织级）
GET /api/orgs/{orgName}/approval-flows/pending

# 审批操作
POST /api/approval-flows/{flowId}/approve
POST /api/approval-flows/{flowId}/reject
{ "comment": "审批备注" }

# 管理员：全局查询
GET /-/admin/approval-flows?flowType=permission:*&status=pending
```

### 业务快捷 API（可选）

为了保持 API 语义清晰，可以提供业务层面的快捷 API，内部调用通用服务：

```http
# 权限申请快捷 API
POST /api/orgs/{orgName}/permission-requests
→ 内部调用 ApprovalFlowService.create({ flowType: 'permission:*', ... })

# 部署审批快捷 API
POST /api/repos/{owner}/{repo}/deploy-approvals
→ 内部调用 ApprovalFlowService.create({ flowType: 'deploy:production', ... })
```

---

## 策略注册

在服务启动时注册所有策略：

```typescript
// server/plugins/approval-strategies.ts

import { registerStrategy } from "~~/server/services/approval-flow/registry";
import { joinTeamStrategy, requestPermissionStrategy } from "~~/server/services/approval-flow/strategies/permission-request";
import { deployApprovalStrategy } from "~~/server/services/approval-flow/strategies/deploy-approval";

export default defineNitroPlugin(() => {
  // 注册权限申请策略
  registerStrategy(joinTeamStrategy);
  registerStrategy(requestPermissionStrategy);

  // 注册部署审批策略
  registerStrategy(deployApprovalStrategy);

  console.log("[ApprovalFlow] Strategies registered");
});
```

---

## 过期处理

使用定时任务处理过期申请：

```typescript
// server/tasks/expire-approval-flows.ts

import { lt, eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { getStrategy } from "~~/server/services/approval-flow/registry";

export default defineTask({
  meta: {
    name: "expire-approval-flows",
    description: "Expire pending approval flows",
  },
  async run() {
    const db = useDB();

    // 查找已过期的待处理申请
    const expiredFlows = await db
      .select()
      .from(schema.approvalFlows)
      .where(
        and(
          eq(schema.approvalFlows.status, "pending"),
          lt(schema.approvalFlows.expires_at, new Date()),
        ),
      );

    for (const flow of expiredFlows) {
      // 更新状态
      await db
        .update(schema.approvalFlows)
        .set({ status: "expired" })
        .where(eq(schema.approvalFlows.id, flow.id));

      // 执行过期回调（如果策略定义了）
      try {
        const strategy = getStrategy(flow.flow_type);
        if (strategy.onExpired) {
          await strategy.onExpired(flow, flow.payload as Record<string, unknown>);
        }
      } catch (e) {
        console.error(`Failed to handle expired flow ${flow.id}:`, e);
      }
    }

    return { result: `Expired ${expiredFlows.length} flows` };
  },
});
```

---

## 优势总结

| 方面 | 传统方式 | 通用框架 |
| ---- | -------- | -------- |
| **代码复用** | 每种审批类型独立实现 | 共享核心流程，只需实现 Strategy |
| **数据模型** | 多个独立表 | 统一 `approval_flows` 表 |
| **飞书集成** | 重复的卡片构建和回调处理 | 统一处理，Strategy 只提供字段 |
| **扩展性** | 新增类型需要大量代码 | 只需实现一个 Strategy |
| **一致性** | 各类型行为可能不一致 | 统一的状态机和流程 |
| **维护性** | 修改流程需要改多处 | 修改核心服务即可 |

---

## 实现计划

### Phase 1：核心框架

- [ ] 创建 `approval_flows` 表和 Drizzle schema
- [ ] 实现 `ApprovalStrategy` 接口和注册表
- [ ] 实现 `ApprovalFlowService` 核心服务
- [ ] 实现飞书卡片回调统一处理

### Phase 2：策略实现

- [ ] 实现权限申请策略（join_team, request_group, request_repo）
- [ ] 迁移现有 `approval_requests` 到新框架
- [ ] 实现部署审批策略

### Phase 3：API 和前端

- [ ] 实现通用审批 API
- [ ] 实现业务快捷 API
- [ ] 前端页面适配

### Phase 4：优化

- [ ] 过期处理定时任务
- [ ] 批量审批功能
- [ ] 审批统计仪表盘

---

## 相关文档

- [飞书集成](./feishu-integration.md) — 消息通知、卡片交互
- [飞书卡片交互](./feishu-card-interaction.md) — FeishuCardBuilder
- [权限系统](./permission-system.md) — 权限组、团队权限
- [API 规范](./api-specification.md) — 路由设计规范
