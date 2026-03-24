import type { Ref, ComputedRef } from "vue";
import type { LockInfo } from "~/composables/usePresetLock";

export interface WorkflowInputDef {
  description?: string;
  required?: boolean;
  default?: string;
  type?: string;
  options?: string[];
}

export interface PresetData {
  preset: {
    id: string;
    share_token: string;
    name: string;
    workflow_path: string;
    workflow_name: string;
    branch: string;
    inputs: Record<string, string>;
    allow_input_override: boolean;
    locked_inputs: string[];
    allow_branch_override: boolean;
    allow_sync_override: boolean;
    locked_by?: string | null;
    locked_at?: string | null;
    auto_unlock_at?: string | null;
  };
  group?: {
    id: string;
    name: string;
    description: string | null;
    auto_unlock_minutes: number | null;
    share_token: string;
  } | null;
  inputDefs: Record<string, WorkflowInputDef>;
  branches: string[];
  repository: {
    id: string;
    full_name: string;
    name: string;
  };
}

export interface HistoryItem {
  id: string;
  action: string;
  actor_name: string | null;
  actor_avatar: string | null;
  created_at: string;
}

export interface JobInfo {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface RunInfo {
  id: number;
  run_number: number;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  html_url: string | null;
  jobs: JobInfo[];
}

export interface StatusData {
  run: RunInfo | null;
  hasRunning: boolean;
  triggeredBy?: {
    name: string;
    avatar_url: string | null;
  } | null;
}

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
  hasEditableInputs: ComputedRef<boolean>;
  showEditInputsModal: Ref<boolean>;
  tempInputs: Ref<Record<string, string>>;
  openEditInputsModal: () => void;
  saveInputs: () => void;

  // 触发运行
  isTriggering: Ref<boolean>;
  triggerRun: () => Promise<void>;
}
