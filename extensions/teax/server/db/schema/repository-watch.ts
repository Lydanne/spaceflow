import { pgTable, uuid, boolean, timestamp, unique, index } from "drizzle-orm/pg-core";
import { repositories } from "./repository";
import { users } from "./user";
import { baseColumns } from "./base";

/**
 * 用户仓库 Watch 状态
 * - watching=true: 用户关注该仓库，接收仓库事件通知
 * - watching=false: 用户取消关注（保留记录用于状态同步）
 */
export const repositoryWatches = pgTable(
  "repository_watches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    repository_id: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    watching: boolean("watching").notNull().default(true),
    synced_at: timestamp("synced_at", { withTimezone: true }).defaultNow(),
    ...baseColumns(),
  },
  (table) => [
    unique("repository_watches_user_repo_unique").on(table.user_id, table.repository_id),
    index("idx_repository_watches_user").on(table.user_id),
    index("idx_repository_watches_repo").on(table.repository_id),
    index("idx_repository_watches_repo_watching").on(table.repository_id, table.watching),
  ],
);
