import {
  pgTable,
  uuid,
  integer,
  varchar,
  text,
  bigserial,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { projects } from "./project";
import { users } from "./user";

export const publishTasks = pgTable(
  "publish_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    branch: varchar("branch", { length: 255 }).notNull(),
    commitSha: varchar("commit_sha", { length: 40 }).notNull(),
    commitMessage: text("commit_message"),
    triggeredBy: uuid("triggered_by").references(() => users.id),
    triggerType: varchar("trigger_type", { length: 50 }).notNull(),
    status: varchar("status", { length: 50 }).default("pending"),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    duration: integer("duration"),
    logUrl: text("log_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  table => [
    index("idx_publish_tasks_project").on(table.projectId),
    index("idx_publish_tasks_status").on(table.status),
  ],
);

export const publishTaskLogs = pgTable(
  "publish_task_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    taskId: uuid("task_id").references(() => publishTasks.id, { onDelete: "cascade" }),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
    level: varchar("level", { length: 10 }).notNull(),
    step: varchar("step", { length: 100 }),
    message: text("message").notNull(),
  },
  table => [index("idx_publish_task_logs_task").on(table.taskId)],
);
