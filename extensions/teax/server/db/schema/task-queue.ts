import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  index,
  integer,
  timestamp,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./user";
import { baseColumns } from "./base";

/**
 * 通用任务队列表
 * 每个队列由唯一 queue_key 标识，支持 FIFO 串行/并发执行。
 * - auto_run: 上一个任务完成后自动触发下一个
 * - concurrency: 并发上限（默认 1 = 串行）
 * - metadata: 队列级别的自定义元数据
 */
export const taskQueues = pgTable(
  "task_queues",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // 队列唯一标识，如 "workflow:{repoId}:{workflowPath}"
    queue_key: varchar("queue_key", { length: 512 }).notNull(),

    // 显示名称
    name: varchar("name", { length: 255 }).notNull(),

    // 自动运行：上一个完成后自动触发下一个
    auto_run: boolean("auto_run").notNull().default(true),

    // 并发上限（默认 1 = 串行执行）
    concurrency: integer("concurrency").notNull().default(1),

    // 队列级别元数据（业务自定义）
    metadata: jsonb("metadata").default({}).$type<Record<string, unknown>>(),

    // 创建者
    created_by: uuid("created_by").references(() => users.id),

    ...baseColumns(),
  },
  (table) => [
    uniqueIndex("idx_task_queues_key").on(table.queue_key),
    index("idx_task_queues_created_by").on(table.created_by),
  ],
);

/**
 * 队列任务项表
 * FIFO 顺序执行，每个 item 携带 payload 元数据。
 * 状态流转: waiting → running → completed/failed/cancelled
 */
export const taskQueueItems = pgTable(
  "task_queue_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // 所属队列
    queue_id: uuid("queue_id")
      .notNull()
      .references(() => taskQueues.id, { onDelete: "cascade" }),

    // FIFO 排序（越小越优先）
    position: integer("position").notNull(),

    // 状态
    status: varchar("status", { length: 32 }).notNull().default("waiting"),

    // 任务携带的元数据
    payload: jsonb("payload").default({}).$type<Record<string, unknown>>(),

    // 任务完成后的结果
    result: jsonb("result").$type<Record<string, unknown>>(),

    // 失败信息
    error: varchar("error", { length: 2048 }),

    // 创建者
    created_by: uuid("created_by").references(() => users.id),

    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    started_at: timestamp("started_at", { withTimezone: true }),
    completed_at: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_task_queue_items_queue").on(table.queue_id),
    index("idx_task_queue_items_status").on(table.queue_id, table.status),
    index("idx_task_queue_items_position").on(table.queue_id, table.position),
  ],
);
