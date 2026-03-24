<script setup lang="ts">
import {
  useWorkflowStatus,
  jobStatusColor,
  jobStatusIcon,
  overallStatusLabel,
  formatDuration,
} from "~/composables/useWorkflowStatus";
import { usePresetLock, type LockInfo } from "~/composables/usePresetLock";
import {
  usePresetHistory,
  actionLabel,
  actionIcon,
  actionColor,
  formatHistoryTime,
} from "~/composables/usePresetHistory";

interface WorkflowInputDef {
  description?: string;
  required?: boolean;
  default?: string;
  type?: string;
  options?: string[];
}

interface PresetData {
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

const props = defineProps<{
  data: PresetData;
  statusUrl?: string;
  runUrl: string;
  directMode?: boolean;
  runDetailUrlPrefix?: string;
  embedded?: boolean;
}>();

const toast = useToast();

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

function openEditInputsModal() {
  // 先用预设默认值初始化，再覆盖用户修改过的值
  // 确保所有值都转换为字符串
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

function saveInputs() {
  overrideInputs.value = { ...tempInputs.value };
  showEditInputsModal.value = false;
}

// 是否有可编辑的参数（任何参数未被锁定）
const hasEditableInputs = computed(() => {
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
      lockInfo?: {
        locked_by: string;
        locked_at: string;
        auto_unlock_at: string | null;
      } | null;
    }>(props.runUrl, { method: "POST", body });
    toast.add({ title: "工作流已触发", color: "success" });

    if (result.run_id) {
      setCurrentRunId(result.run_id);
    }

    if (result.lockInfo) {
      updateLockInfo(result.lockInfo);
    }

    if (
      props.statusUrl ||
      (props.directMode && result.run_id && props.runDetailUrlPrefix)
    ) {
      await refreshStatus();
      startPolling();
    }
  } catch (err: unknown) {
    const msg =
      (err as { data?: { message?: string } })?.data?.message || "触发失败";
    toast.add({ title: msg, color: "error" });
  } finally {
    isTriggering.value = false;
  }
}
</script>

<template>
  <div :class="embedded ? '' : 'max-w-2xl mx-auto px-4 py-12'">
    <!-- 头部 - 嵌入模式 -->
    <div v-if="embedded" class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ data.preset.name }}
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 font-mono">
          {{ data.preset.workflow_path }}
        </p>
      </div>
      <UButton
        color="primary"
        :icon="statusData?.hasRunning ? 'i-lucide-loader' : 'i-lucide-play'"
        :loading="isTriggering"
        :disabled="statusData?.hasRunning"
        @click="triggerRun"
      >
        {{ statusData?.hasRunning ? "运行中..." : "运行" }}
      </UButton>
    </div>

    <!-- 头部 - 独立页面模式（卡片样式） -->
    <UCard v-else class="mb-6">
      <div class="flex items-center gap-6">
        <!-- 预设名称 -->
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-bookmark" class="w-4 h-4 text-gray-400" />
          <NuxtLink
            v-if="data.group"
            :to="`/workflow-groups/${data.group.share_token}`"
            class="font-medium text-primary-500 hover:text-primary-600"
          >
            {{ data.group.name }} /
          </NuxtLink>
          <span class="font-medium">{{ data.preset.name }}</span>
        </div>

        <!-- 仓库 -->
        <!-- <div class="flex items-center gap-2">
          <UIcon name="i-lucide-git-fork" class="w-4 h-4 text-gray-400" />
          <span class="text-sm font-mono text-gray-600 dark:text-gray-400">{{
            data.repository.full_name
          }}</span>
        </div> -->

        <!-- 分隔 -->
        <div class="flex-1" />

        <!-- 子预设锁定状态 -->
        <div v-if="isSubPreset" class="flex items-center gap-2">
          <template v-if="lockState">
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400 rounded text-xs font-medium"
            >
              <UIcon name="i-lucide-lock" class="w-3 h-3" />
              已锁定
            </span>
            <span
              v-if="lockState.auto_unlock_at"
              class="text-xs text-gray-400"
            >
              {{ new Date(lockState.auto_unlock_at).toLocaleTimeString() }}
            </span>
            <UButton
              size="xs"
              variant="ghost"
              color="warning"
              icon="i-lucide-unlock"
              :loading="isUnlocking"
              @click="unlockPreset"
            >
              解锁
            </UButton>
          </template>
          <UButton
            v-else
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-lock"
            :loading="isLocking"
            @click="lockPreset"
          >
            锁定
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- 配置卡片 -->
    <UCard class="mb-6">
      <div class="space-y-4">
        <!-- 分支 -->
        <div class="flex items-center gap-3">
          <UIcon
            name="i-lucide-git-branch"
            class="w-5 h-5 text-gray-400 shrink-0"
          />
          <div class="flex-1">
            <p class="text-xs text-gray-400 mb-1">分支</p>
            <USelect
              v-if="
                data.preset.allow_branch_override && data.branches.length > 0
              "
              v-model="overrideBranch"
              :items="data.branches.map((b) => ({ label: b, value: b }))"
              value-key="value"
              class="w-full"
            >
              <template #leading>
                <span class="text-gray-500">xgj/</span>
              </template>
            </USelect>
            <p v-else class="font-medium font-mono">
              {{ data.preset.branch }}
            </p>
          </div>
        </div>

        <!-- 参数 -->
        <div
          v-if="Object.keys(data.preset.inputs || {}).length > 0"
          class="border-t border-gray-200 dark:border-gray-700 pt-4"
        >
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs text-gray-400">预设参数</p>
            <UButton
              v-if="hasEditableInputs"
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-pencil"
              @click="openEditInputsModal"
            >
              修改
            </UButton>
          </div>
          <div class="space-y-3">
            <div v-for="(value, key) in data.preset.inputs" :key="key">
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-500">{{ key }}</span>
                <span class="font-mono text-gray-900 dark:text-white">{{
                  overrideInputs[key] ?? value
                }}</span>
              </div>
              <p
                v-if="data.inputDefs[key]?.description"
                class="text-xs text-gray-400 mt-0.5"
              >
                {{ data.inputDefs[key].description }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </UCard>

    <!-- 运行状态 -->
    <div v-if="statusData?.run" class="mb-6">
      <UCard>
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <UIcon
              :name="
                jobStatusIcon(statusData.run.status, statusData.run.conclusion)
              "
              class="w-5 h-5"
              :class="{
                'text-blue-500':
                  jobStatusColor(
                    statusData.run.status,
                    statusData.run.conclusion,
                  ) === 'info',
                'text-amber-500 animate-spin':
                  jobStatusColor(
                    statusData.run.status,
                    statusData.run.conclusion,
                  ) === 'warning',
                'text-green-500':
                  jobStatusColor(
                    statusData.run.status,
                    statusData.run.conclusion,
                  ) === 'success',
                'text-red-500':
                  jobStatusColor(
                    statusData.run.status,
                    statusData.run.conclusion,
                  ) === 'error',
                'text-gray-400':
                  jobStatusColor(
                    statusData.run.status,
                    statusData.run.conclusion,
                  ) === 'neutral',
              }"
            />
            <span class="font-medium">
              运行 #{{ statusData.run.run_number }}
            </span>
            <UBadge
              :color="
                jobStatusColor(
                  statusData.run.status,
                  statusData.run.conclusion,
                ) as any
              "
              variant="subtle"
              size="sm"
            >
              {{
                overallStatusLabel(
                  statusData.run.status,
                  statusData.run.conclusion,
                )
              }}
            </UBadge>
          </div>
          <div
            v-if="statusData.triggeredBy"
            class="flex items-center gap-2 text-sm text-gray-500"
          >
            <UAvatar
              :src="statusData.triggeredBy.avatar_url || undefined"
              :alt="statusData.triggeredBy.name"
              size="xs"
            />
            <span>{{ statusData.triggeredBy.name }} 触发</span>
          </div>
          <div class="flex items-center gap-3">
            <span
              v-if="
                formatDuration(
                  statusData.run.started_at,
                  statusData.run.completed_at,
                )
              "
              class="text-sm text-gray-400"
            >
              {{
                formatDuration(
                  statusData.run.started_at,
                  statusData.run.completed_at,
                )
              }}
            </span>
            <UButton
              v-if="statusData.run.html_url"
              :to="statusData.run.html_url"
              external
              target="_blank"
              variant="ghost"
              size="xs"
              icon="i-lucide-external-link"
            >
              查看详情
            </UButton>
          </div>
        </div>

        <!-- Jobs 阶段 -->
        <div v-if="statusData.run.jobs.length > 0" class="space-y-2">
          <div
            v-for="job in statusData.run.jobs"
            :key="job.id"
            class="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
          >
            <UIcon
              :name="jobStatusIcon(job.status, job.conclusion)"
              class="w-4 h-4 shrink-0"
              :class="{
                'text-blue-500':
                  jobStatusColor(job.status, job.conclusion) === 'info',
                'text-amber-500 animate-spin':
                  jobStatusColor(job.status, job.conclusion) === 'warning',
                'text-green-500':
                  jobStatusColor(job.status, job.conclusion) === 'success',
                'text-red-500':
                  jobStatusColor(job.status, job.conclusion) === 'error',
                'text-gray-400':
                  jobStatusColor(job.status, job.conclusion) === 'neutral',
              }"
            />
            <span class="flex-1 text-sm">{{ job.name }}</span>
            <span
              v-if="formatDuration(job.started_at, job.completed_at)"
              class="text-xs text-gray-400"
            >
              {{ formatDuration(job.started_at, job.completed_at) }}
            </span>
          </div>
        </div>
      </UCard>
    </div>

    <!-- 触发按钮 - 独立页面模式 -->
    <div v-if="!embedded" class="text-center">
      <UButton
        size="lg"
        color="primary"
        :icon="statusData?.hasRunning ? 'i-lucide-loader' : 'i-lucide-play'"
        :loading="isTriggering"
        :disabled="statusData?.hasRunning"
        @click="triggerRun"
      >
        {{ statusData?.hasRunning ? "运行中..." : "运行" }}
      </UButton>
      <p v-if="statusData?.hasRunning" class="text-sm text-gray-400 mt-2">
        请等待当前运行完成
      </p>
    </div>

    <!-- 操作日志 - 仅子预设显示 -->
    <div v-if="isSubPreset && !embedded" class="mt-6">
      <UButton
        variant="ghost"
        color="neutral"
        size="sm"
        class="w-full"
        @click="toggleHistory"
      >
        <UIcon
          :name="showHistory ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          class="w-4 h-4 mr-1"
        />
        操作日志
      </UButton>

      <div v-if="showHistory" class="mt-4">
        <!-- 加载中 -->
        <div
          v-if="loadingHistory"
          class="flex items-center justify-center py-8"
        >
          <UIcon name="i-lucide-loader" class="w-5 h-5 animate-spin text-gray-400" />
        </div>

        <!-- 历史列表 -->
        <div v-else-if="historyData.length > 0" class="space-y-3">
          <div
            v-for="item in historyData"
            :key="item.id"
            class="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
          >
            <UIcon
              :name="actionIcon(item.action)"
              class="w-4 h-4 mt-0.5 shrink-0"
              :class="actionColor(item.action)"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium">{{ actionLabel(item.action) }}</span>
                <span class="text-xs text-gray-400">{{ formatHistoryTime(item.created_at) }}</span>
              </div>
              <div
                v-if="item.actor_name"
                class="flex items-center gap-1.5 mt-1"
              >
                <UAvatar
                  :src="item.actor_avatar || undefined"
                  :alt="item.actor_name"
                  size="2xs"
                />
                <span class="text-xs text-gray-500">{{ item.actor_name }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div
          v-else
          class="text-center text-sm text-gray-400 py-8"
        >
          暂无操作记录
        </div>
      </div>
    </div>

    <!-- 修改参数弹窗 -->
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

          <div
            class="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4"
          >
            <UButton
              color="neutral"
              variant="ghost"
              @click="showEditInputsModal = false"
            >
              取消
            </UButton>
            <UButton color="primary" @click="saveInputs"> 保存 </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
