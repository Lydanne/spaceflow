import { lt } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { withTaskLogging } from "~~/server/utils/task-logger";

/**
 * 清理预设操作历史记录
 * 每月执行一次，删除 30 天前的旧数据
 */
export default defineTask({
  meta: {
    name: "presets:cleanup-history",
    description: "清理 30 天前的预设操作历史记录",
  },
  async run() {
    return await withTaskLogging("presets:cleanup-history", async () => {
      const db = useDB();

      // 计算 30 天前的时间点
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // 删除 30 天前的历史记录
      const result = await db
        .delete(schema.workflowPresetHistory)
        .where(lt(schema.workflowPresetHistory.created_at, thirtyDaysAgo))
        .returning({ id: schema.workflowPresetHistory.id });

      const deletedCount = result.length;

      console.log(`[presets:cleanup-history] Deleted ${deletedCount} old history records`);

      return {
        result: "success",
        deletedCount,
        cutoffDate: thirtyDaysAgo.toISOString(),
      };
    });
  },
});
