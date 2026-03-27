import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";

// 系统用户 ID，用于记录自动解锁等系统操作
export const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

export interface LockResult {
  success: boolean;
  locked_by: string;
  locked_at: Date;
  auto_unlock_at: Date | null;
}

export interface UnlockResult {
  success: boolean;
}

export interface TriggerLockRefreshPayload {
  lockOwner: string;
  lockedAt: Date;
  autoUnlockAt: Date | null;
  lockInfo: {
    locked_by: string;
    locked_at: string;
    auto_unlock_at: string | null;
  };
}

/**
 * 计算“触发后刷新锁定时间”的字段
 * - 保留已有锁定者；若无则使用当前触发人
 * - 自动解锁时间从当前时刻按分钟数重算
 */
export function buildTriggerLockRefresh(
  params: {
    currentLockedBy: string | null;
    actorId: string;
    autoUnlockMinutes: number | null | undefined;
  },
): TriggerLockRefreshPayload {
  const now = new Date();
  const autoUnlockAt = params.autoUnlockMinutes
    ? new Date(now.getTime() + params.autoUnlockMinutes * 60 * 1000)
    : null;
  const lockOwner = params.currentLockedBy || params.actorId;

  return {
    lockOwner,
    lockedAt: now,
    autoUnlockAt,
    lockInfo: {
      locked_by: lockOwner,
      locked_at: now.toISOString(),
      auto_unlock_at: autoUnlockAt?.toISOString() || null,
    },
  };
}

/**
 * 锁定预设
 */
export async function lockPreset(
  presetId: string,
  userId: string,
  groupId: string | null,
): Promise<LockResult> {
  const db = useDB();

  // 获取 group 的自动解锁时间配置
  let autoUnlockAt: Date | null = null;
  if (groupId) {
    const [group] = await db
      .select({ auto_unlock_minutes: schema.workflowPresetGroups.auto_unlock_minutes })
      .from(schema.workflowPresetGroups)
      .where(eq(schema.workflowPresetGroups.id, groupId))
      .limit(1);

    if (group?.auto_unlock_minutes) {
      autoUnlockAt = new Date(Date.now() + group.auto_unlock_minutes * 60 * 1000);
    }
  }

  const now = new Date();

  // 锁定预设
  await db
    .update(schema.workflowPresets)
    .set({
      locked_by: userId,
      locked_at: now,
      auto_unlock_at: autoUnlockAt,
    })
    .where(eq(schema.workflowPresets.id, presetId));

  // 写入历史记录
  await db.insert(schema.workflowPresetHistory).values({
    preset_id: presetId,
    action: "lock",
    actor_id: userId,
    details: {
      auto_unlock_at: autoUnlockAt?.toISOString() || null,
    },
  });

  return {
    success: true,
    locked_by: userId,
    locked_at: now,
    auto_unlock_at: autoUnlockAt,
  };
}

/**
 * 解锁预设
 */
export async function unlockPreset(
  presetId: string,
  userId: string,
  reason: "manual" | "timeout" | "approved" = "manual",
): Promise<UnlockResult> {
  const db = useDB();

  // 解锁预设
  await db
    .update(schema.workflowPresets)
    .set({
      locked_by: null,
      locked_at: null,
      auto_unlock_at: null,
    })
    .where(eq(schema.workflowPresets.id, presetId));

  // 写入历史记录
  await db.insert(schema.workflowPresetHistory).values({
    preset_id: presetId,
    action: "unlock",
    actor_id: userId,
    details: {
      reason,
    },
  });

  return { success: true };
}

/**
 * 记录触发历史
 */
export async function recordTriggerHistory(
  presetId: string,
  userId: string,
  details: {
    run_id: number | null;
    run_number: number | null;
    branch: string;
    inputs: Record<string, unknown>;
  },
): Promise<void> {
  const db = useDB();

  await db.insert(schema.workflowPresetHistory).values({
    preset_id: presetId,
    action: "trigger",
    actor_id: userId,
    details,
  });
}

/**
 * 记录自动锁定历史（仅记录，不执行锁定操作）
 * 用于触发运行时已经在同一事务中锁定了预设的情况
 */
export async function recordAutoLockHistory(
  presetId: string,
  userId: string,
  autoUnlockAt: string | null,
): Promise<void> {
  const db = useDB();

  await db.insert(schema.workflowPresetHistory).values({
    preset_id: presetId,
    action: "lock",
    actor_id: userId,
    details: {
      auto_unlock_at: autoUnlockAt,
      reason: "auto_on_trigger",
    },
  });
}
