import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  index,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * 定时任务执行日志表
 * 记录所有定时任务的执行历史
 */
export const taskExecutionLogs = pgTable(
  "task_execution_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // 任务信息
    task_name: varchar("task_name", { length: 128 }).notNull(),

    // 执行状态: 'running', 'completed', 'failed'
    status: varchar("status", { length: 32 }).notNull(),

    // 执行时间
    started_at: timestamp("started_at", { withTimezone: true }).notNull(),
    finished_at: timestamp("finished_at", { withTimezone: true }),
    duration_ms: integer("duration_ms"),

    // 执行结果
    result: jsonb("result").$type<Record<string, unknown>>(),
    error_message: text("error_message"),
    error_stack: text("error_stack"),

    // 任务输入参数
    payload: jsonb("payload").$type<Record<string, unknown>>(),

    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_task_logs_name").on(table.task_name),
    index("idx_task_logs_status").on(table.status),
    index("idx_task_logs_started").on(table.started_at),
  ],
);

// 任务状态枚举
export type TaskExecutionStatus = "running" | "completed" | "failed";
