import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import type { ResolvedPreset } from "~~/server/utils/resolve-preset";
import {
  buildTriggerLockRefresh,
  recordAutoLockHistory,
  recordTriggerHistory,
} from "./preset-lock.service";

export interface PresetExecutionMeta {
  branch: string;
  inputs: Record<string, unknown> | null;
  allow_input_override: boolean | null;
  allow_branch_override: boolean | null;
  locked_inputs: string[] | null;
  group_id: string | null;
  locked_by: string | null;
}

export interface BuildRunConfigParams {
  preset: PresetExecutionMeta;
  actorId: string;
  branchOverride?: unknown;
  inputOverrides?: Record<string, unknown>;
}

export interface RunConfigResult {
  finalInputs: Record<string, unknown>;
  finalBranch: string;
  canModifyOverride: boolean;
}

export interface PersistTriggerParams {
  preset: ResolvedPreset["preset"];
  actorId: string;
  runId: number | null;
  runNumber: number | null;
  branch: string;
  inputs: Record<string, unknown>;
  syncBranchToPreset?: string;
  syncInputsToPreset?: Record<string, unknown>;
}

export interface PersistTriggerResult {
  lock_info: {
    locked_by: string;
    locked_at: string;
    auto_unlock_at: string | null;
  } | null;
}

/**
 * 统一计算触发工作流时的最终参数
 * - 被他人锁定时可执行但不可改
 * - allow_input_override 作为参数覆盖总开关
 * - allow_branch_override 作为分支覆盖开关
 * - locked_inputs 为不可修改参数白名单
 */
export function buildRunConfig(params: BuildRunConfigParams): RunConfigResult {
  const { preset, actorId, branchOverride, inputOverrides } = params;

  const isLockedByOther = !!(
    preset.group_id
    && preset.locked_by
    && preset.locked_by !== actorId
  );
  const canModifyOverride = !isLockedByOther;

  const finalInputs: Record<string, unknown> = {
    ...(preset.inputs || {}),
  };
  let finalBranch = preset.branch;

  if (canModifyOverride && preset.allow_input_override && inputOverrides) {
    const lockedInputs = new Set<string>(preset.locked_inputs || []);
    for (const [key, value] of Object.entries(inputOverrides)) {
      if (lockedInputs.has(key)) continue;
      finalInputs[key] = value;
    }
  }

  if (
    canModifyOverride
    && preset.allow_branch_override
    && typeof branchOverride === "string"
    && branchOverride
  ) {
    finalBranch = branchOverride;
  }

  return {
    finalInputs,
    finalBranch,
    canModifyOverride,
  };
}

export function pickInputOverridesFromForm(
  formValue: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(formValue)) {
    if (key === "branch") continue;
    result[key] = value;
  }
  return result;
}

/**
 * 持久化触发结果（run_id、锁定信息、历史记录）
 */
export async function persistPresetTriggerResult(
  params: PersistTriggerParams,
): Promise<PersistTriggerResult> {
  const {
    preset,
    actorId,
    runId,
    runNumber,
    branch,
    inputs,
    syncBranchToPreset,
    syncInputsToPreset,
  } = params;
  const db = useDB();

  let lockInfo: PersistTriggerResult["lock_info"] = null;

  if (runId) {
    const updateData: Record<string, unknown> = {
      current_run_id: runId,
      last_triggered_by: actorId,
    };
    if (syncBranchToPreset !== undefined) {
      updateData.branch = syncBranchToPreset;
    }
    if (syncInputsToPreset !== undefined) {
      updateData.inputs = syncInputsToPreset;
    }

    if (preset.group_id) {
      const [group] = await db
        .select({ auto_unlock_minutes: schema.workflowPresetGroups.auto_unlock_minutes })
        .from(schema.workflowPresetGroups)
        .where(eq(schema.workflowPresetGroups.id, preset.group_id))
        .limit(1);

      const lockRefresh = buildTriggerLockRefresh({
        currentLockedBy: preset.locked_by,
        actorId,
        autoUnlockMinutes: group?.auto_unlock_minutes,
      });
      updateData.locked_by = lockRefresh.lockOwner;
      updateData.locked_at = lockRefresh.lockedAt;
      updateData.auto_unlock_at = lockRefresh.autoUnlockAt;
      lockInfo = lockRefresh.lockInfo;
    }

    await db
      .update(schema.workflowPresets)
      .set(updateData)
      .where(eq(schema.workflowPresets.id, preset.id));

    if (preset.group_id) {
      await recordTriggerHistory(preset.id, actorId, {
        run_id: runId,
        run_number: runNumber,
        branch,
        inputs,
      });

      if (lockInfo) {
        await recordAutoLockHistory(preset.id, actorId, lockInfo.auto_unlock_at);
      }
    }
  }

  return { lock_info: lockInfo };
}

/**
 * 通过 share token 解锁预设
 */
export async function unlockPresetByShareToken(shareToken: string): Promise<void> {
  const db = useDB();
  await db
    .update(schema.workflowPresets)
    .set({ locked_by: null, locked_at: null, auto_unlock_at: null })
    .where(eq(schema.workflowPresets.share_token, shareToken));
}

/**
 * 获取锁定用户展示名
 */
export async function getLockerDisplayName(userId: string): Promise<string> {
  const db = useDB();
  const [locker] = await db
    .select({ name: schema.users.gitea_username })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return locker?.name ?? "未知用户";
}
