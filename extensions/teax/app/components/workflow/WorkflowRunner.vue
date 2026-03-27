<script setup lang="ts">
import { useWorkflowStatus } from "~/composables/useWorkflowStatus";
import { usePresetLock, type LockInfo } from "~/composables/usePresetLock";
import { usePresetHistory } from "~/composables/usePresetHistory";
import type { PresetData, WorkflowRunnerContext } from "./useWorkflowRunnerContext";

const props = defineProps<{
  data: PresetData;
  statusUrl?: string;
  runUrl: string;
  directMode?: boolean;
  runDetailUrlPrefix?: string;
  embedded?: boolean;
}>();

const toast = useToast();

// 响应式 data 引用
const dataRef = computed(() => props.data);

// 是否是子预设（属于某个 group）
const isSubPreset = computed(() => !!props.data.group);

// 运行状态管理
const {
  statusData,
  refreshStatus,
  startPolling,
  setCurrentRunId,
} = useWorkflowStatus({
  statusUrl: props.statusUrl,
  directMode: props.directMode,
  runDetailUrlPrefix: props.runDetailUrlPrefix,
});

// 锁定状态管理
const initialLockInfo = computed<LockInfo | null>(() => {
  if (props.data.preset.locked_by) {
    return {
      locked_by: props.data.preset.locked_by,
      locked_at: props.data.preset.locked_at || "",
      auto_unlock_at: props.data.preset.auto_unlock_at || null,
    };
  }
  return null;
});

const {
  isLocking,
  isUnlocking,
  lockState,
  updateLockInfo,
  lock: lockPreset,
  unlock: unlockPreset,
} = usePresetLock({
  shareToken: props.data.preset.share_token,
  initialLockInfo: initialLockInfo.value,
  isSubPreset,
});

// 操作历史管理
const {
  historyData,
  loadingHistory,
  showHistory,
  toggleHistory,
} = usePresetHistory({
  shareToken: props.data.preset.share_token,
  isSubPreset,
});

// 用户可修改的输入值
const overrideInputs = ref<Record<string, string>>({});
const showEditInputsModal = ref(false);
const tempInputs = ref<Record<string, string>>({});

// 用户可修改的分支
const overrideBranch = ref("");

// 初始化
watch(
  () => props.data.preset,
  (preset) => {
    if (preset) {
      overrideInputs.value = { ...preset.inputs };
      overrideBranch.value = preset.branch;
    }
  },
  { immediate: true },
);

// 监听分支变化，同步到数据库
watch(overrideBranch, async (newBranch, oldBranch) => {
  // 跳过初始化
  if (!oldBranch || newBranch === oldBranch) return;
  await syncOverrideToDb();
});

function openEditInputsModal() {
  const presetInputs = props.data.preset.inputs || {};
  const stringifiedInputs: Record<string, string> = {};
  for (const [key, value] of Object.entries(presetInputs)) {
    stringifiedInputs[key] = String(value ?? "");
  }
  for (const [key, value] of Object.entries(overrideInputs.value)) {
    stringifiedInputs[key] = String(value ?? "");
  }
  tempInputs.value = stringifiedInputs;
  showEditInputsModal.value = true;
}

async function saveInputs() {
  overrideInputs.value = { ...tempInputs.value };
  showEditInputsModal.value = false;
  // 如果允许同步，保存到数据库
  await syncOverrideToDb();
}

// 同步用户修改到数据库
async function syncOverrideToDb() {
  console.log("[syncOverrideToDb] allow_sync_override:", props.data.preset.allow_sync_override);
  if (!props.data.preset.allow_sync_override) return;

  try {
    console.log("[syncOverrideToDb] syncing...", { branch: overrideBranch.value, inputs: overrideInputs.value });
    await $fetch(`/api/workflow-presets/${props.data.preset.share_token}/sync`, {
      method: "POST",
      body: {
        branch: overrideBranch.value,
        inputs: overrideInputs.value,
      },
    });
    console.log("[syncOverrideToDb] sync success");
  } catch (err) {
    console.error("Failed to sync override:", err);
  }
}

// 是否有可编辑的参数（任何参数未被锁定）
const hasEditableInputs = computed(() => {
  if (!props.data.preset.allow_input_override) return false;
  const inputKeys = Object.keys(props.data.preset.inputs || {});
  const lockedInputs = props.data.preset.locked_inputs || [];
  return inputKeys.some((key) => !lockedInputs.includes(key));
});

// 触发运行
const isTriggering = ref(false);

async function triggerRun() {
  if (statusData.value?.hasRunning) {
    toast.add({ title: "请等待当前运行完成", color: "warning" });
    return;
  }

  isTriggering.value = true;
  try {
    let body: Record<string, unknown>;
    if (props.directMode) {
      body = {
        workflow_id: props.data.preset.workflow_path,
        ref: overrideBranch.value,
        inputs: overrideInputs.value,
      };
    } else {
      body = {};
      if (hasEditableInputs.value) {
        const lockedInputs = props.data.preset.locked_inputs || [];
        const editableInputs: Record<string, string> = {};
        for (const [key, value] of Object.entries(overrideInputs.value)) {
          if (!lockedInputs.includes(key)) {
            editableInputs[key] = value;
          }
        }
        if (Object.keys(editableInputs).length > 0) {
          body.inputs = editableInputs;
        }
      }
      if (props.data.preset.allow_branch_override) {
        body.branch = overrideBranch.value;
      }
    }
    const result = await $fetch<{
      success: boolean;
      run_id?: number;
      lock_info?: {
        locked_by: string;
        locked_at: string;
        auto_unlock_at: string | null;
      };
    }>(props.runUrl, { method: "POST", body });
    toast.add({ title: "工作流已触发", color: "success" });

    if (result.run_id) {
      setCurrentRunId(result.run_id);
    }

    if (result.lock_info) {
      updateLockInfo(result.lock_info);
    }

    if (
      props.statusUrl
      || (props.directMode && result.run_id && props.runDetailUrlPrefix)
    ) {
      await refreshStatus();
      startPolling();
    }
  } catch (err: unknown) {
    const msg
      = (err as { data?: { message?: string } })?.data?.message || "触发失败";
    toast.add({ title: msg, color: "error" });
  } finally {
    isTriggering.value = false;
  }
}

// 构建 context 传递给子组件
const ctx: WorkflowRunnerContext = {
  data: dataRef,
  isSubPreset,
  statusData,
  lockState,
  isLocking,
  isUnlocking,
  lockPreset,
  unlockPreset,
  historyData,
  loadingHistory,
  showHistory,
  toggleHistory,
  overrideInputs,
  overrideBranch,
  hasEditableInputs,
  showEditInputsModal,
  tempInputs,
  openEditInputsModal,
  saveInputs,
  isTriggering,
  triggerRun,
};
</script>

<template>
  <div>
    <!-- 嵌入模式 -->
    <WorkflowRunnerEmbedded
      v-if="embedded"
      :ctx="ctx"
    />

    <!-- 独立页面模式 -->
    <WorkflowRunnerStandalone
      v-else
      :ctx="ctx"
    />

    <!-- 修改参数弹窗（共享） -->
    <UModal v-model:open="showEditInputsModal">
      <template #content>
        <div class="p-6 flex flex-col max-h-[80vh]">
          <h3 class="text-lg font-semibold">修改运行参数</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
            修改参数值后点击保存，下次运行将使用新的参数
          </p>

          <div class="flex-1 overflow-y-auto space-y-4 pr-1">
            <WorkflowInputsForm
              v-model="tempInputs"
              :input-defs="data.inputDefs"
              :locked-inputs="data.preset.locked_inputs"
            />
          </div>

          <div class="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
            <UButton
              color="neutral"
              variant="ghost"
              @click="showEditInputsModal = false"
            >
              取消
            </UButton>
            <UButton
              color="primary"
              @click="saveInputs"
            >
              保存
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
