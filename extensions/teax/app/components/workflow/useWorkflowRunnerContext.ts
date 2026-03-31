import type { Ref, ComputedRef } from "vue";
import type { LockInfo } from "~/composables/usePresetLock";
import type {
  WorkflowPresetHistoryItemDto,
  WorkflowPresetPageDataDto,
  WorkflowPresetStatusDto,
  WorkflowPresetStatusRunDto,
  WorkflowPresetStatusRunJobDto,
} from "~~/server/shared/dto";

export type PresetData = WorkflowPresetPageDataDto;
export type HistoryItem = WorkflowPresetHistoryItemDto;
export type JobInfo = WorkflowPresetStatusRunJobDto;
export type RunInfo = WorkflowPresetStatusRunDto;
export type StatusData = WorkflowPresetStatusDto;

export interface WorkflowRunnerContext {
  // 数据
  data: Ref<PresetData>;
  isSubPreset: ComputedRef<boolean>;

  // 运行状态
  statusData: Ref<StatusData | null>;

  // 锁定状态
  lockState: Ref<LockInfo | null>;
  isLocking: Ref<boolean>;
  isUnlocking: Ref<boolean>;
  lockPreset: () => Promise<void>;
  unlockPreset: () => Promise<void>;

  // 操作历史
  historyData: Ref<HistoryItem[]>;
  loadingHistory: Ref<boolean>;
  showHistory: Ref<boolean>;
  toggleHistory: () => void;

  // 输入参数
  overrideInputs: Ref<Record<string, string>>;
  overrideBranch: Ref<string>;
  canModifyOverride: ComputedRef<boolean>;
  hasEditableInputs: ComputedRef<boolean>;
  showEditInputsModal: Ref<boolean>;
  tempInputs: Ref<Record<string, string>>;
  openEditInputsModal: () => void;
  saveInputs: () => void;

  // 触发运行
  isTriggering: Ref<boolean>;
  triggerRun: () => Promise<void>;
}
