import { and, isNotNull, lte } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { withTaskLogging } from "~~/server/utils/task-logger";
import { unlockPreset, SYSTEM_USER_ID } from "~~/server/services/preset-lock.service";

/**
 * 子预设自动解锁任务
 * 检查并解锁超过 auto_unlock_at 时间的子预设
 */
export default defineTask({
  meta: {
    name: "presets:unlock-expired",
    description: "自动解锁过期的子预设",
  },
  async run() {
    return await withTaskLogging("presets:unlock-expired", async () => {
      const db = useDB();
      const now = new Date();

      // 查找过期的子预设（group_id 不为空表示是子预设）
      const expired = await db
        .select({
          id: schema.workflowPresets.id,
          name: schema.workflowPresets.name,
        })
        .from(schema.workflowPresets)
        .where(
          and(
            isNotNull(schema.workflowPresets.group_id),
            isNotNull(schema.workflowPresets.auto_unlock_at),
            lte(schema.workflowPresets.auto_unlock_at, now),
          ),
        );

      if (expired.length === 0) {
        return { result: "success", unlockedCount: 0 };
      }

      // 批量解锁并记录历史
      const unlockedIds: string[] = [];

      for (const preset of expired) {
        try {
          await unlockPreset(preset.id, SYSTEM_USER_ID, "timeout");
          unlockedIds.push(preset.id);
          console.log(`[presets:unlock-expired] Unlocked preset: ${preset.name} (${preset.id})`);
        } catch (error) {
          console.error(`[presets:unlock-expired] Failed to unlock preset ${preset.id}:`, error);
        }
      }

      return {
        result: "success",
        unlockedCount: unlockedIds.length,
        unlockedIds,
      };
    });
  },
});
