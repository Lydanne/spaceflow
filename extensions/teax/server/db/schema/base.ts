import { uuid, timestamp } from "drizzle-orm/pg-core";

/**
 * 所有表的公共字段。
 * - rowCreator: 记录创建者（不参与业务逻辑）
 * - createdAt: 创建时间
 * - updatedAt: 更新时间
 *
 * 用法：在表定义中展开 `...baseColumns()`
 */
export function baseColumns() {
  return {
    rowCreator: uuid("row_creator"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  };
}
