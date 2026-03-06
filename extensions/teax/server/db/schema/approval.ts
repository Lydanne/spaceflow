import { pgTable, uuid, varchar, text, jsonb, index } from "drizzle-orm/pg-core";
import { users } from "./user";
import { repositories } from "./repository";
import { organizations } from "./organization";
import { baseColumns } from "./base";

export const approvalRequests = pgTable(
  "approval_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organization_id: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    repository_id: uuid("repository_id")
      .references(() => repositories.id, { onDelete: "set null" }),
    requester_id: uuid("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** 审批类型：deploy（部署审批）、rollback（回滚审批）、custom（自定义） */
    type: varchar("type", { length: 50 }).notNull().default("deploy"),
    /** 审批状态：pending / approved / rejected / cancelled */
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    /** 飞书审批实例 code（由飞书 API 返回） */
    feishu_instance_code: varchar("feishu_instance_code", { length: 255 }),
    /** 审批标题 */
    title: varchar("title", { length: 500 }).notNull(),
    /** 审批描述/原因 */
    description: text("description"),
    /** 审批关联信息（如 branch、workflow、commit sha 等） */
    metadata: jsonb("metadata").default({}),
    /** 审批人（飞书 open_id） */
    approver_open_id: varchar("approver_open_id", { length: 255 }),
    /** 审批人备注 */
    approver_comment: text("approver_comment"),
    ...baseColumns(),
  },
  (table) => [
    index("idx_approval_org").on(table.organization_id),
    index("idx_approval_repo").on(table.repository_id),
    index("idx_approval_status").on(table.status),
    index("idx_approval_feishu").on(table.feishu_instance_code),
  ],
);
