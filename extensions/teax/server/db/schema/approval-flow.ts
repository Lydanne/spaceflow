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
    // 例如: 'permission:scene', 'deploy:production', 'config:sensitive'
    flow_type: varchar("flow_type", { length: 100 }).notNull(),

    // ─── 状态 ───────────────────────────────────────────────
    // 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired'
    status: varchar("status", { length: 50 }).notNull().default("pending"),

    // ─── 申请信息 ───────────────────────────────────────────
    title: varchar("title", { length: 500 }).notNull(),
    reason: text("reason"),

    // 业务数据（JSON，由 Strategy 定义结构）
    payload: jsonb("payload").notNull().default({}),

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
