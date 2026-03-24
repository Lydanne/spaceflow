<script setup lang="ts">
import type { JobInfo } from "./JobLogsPanel.vue";
import {
  jobStatusColor,
  jobStatusIcon,
  overallStatusLabel,
  formatDuration,
} from "~/composables/useWorkflowStatus";
import {
  actionLabel,
  actionIcon,
  actionColor,
  formatHistoryTime,
} from "~/composables/usePresetHistory";
import type { WorkflowRunnerContext } from "./useWorkflowRunnerContext";

const props = defineProps<{
  ctx: WorkflowRunnerContext;
}>();

const {
  data,
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
  openEditInputsModal,
  isTriggering,
  triggerRun,
} = props.ctx;

// 状态图标样式类
function statusIconClass(status: string, conclusion: string | null): string {
  const color = jobStatusColor(status, conclusion);
  if (color === "info") return "text-blue-500";
  if (color === "warning") return "text-amber-500 animate-spin";
  if (color === "success") return "text-green-500";
  if (color === "error") return "text-red-500";
  return "text-gray-400";
}

// ==================== 日志查看 ====================
const showLogs = ref(false);

// 获取仓库信息用于日志 API
const repoFullName = computed(() => data.value.repository.full_name);
const repoOwner = computed(() => repoFullName.value.split("/")[0] || "");
const repoName = computed(() => repoFullName.value.split("/")[1] || "");

// 转换 jobs 为 JobInfo 格式
const jobsForPanel = computed<JobInfo[]>(() => {
  const jobs = statusData.value?.run?.jobs || [];
  return jobs.map((j) => ({
    id: j.id,
    name: j.name,
    status: j.status,
    conclusion: j.conclusion,
    startedAt: j.started_at,
    completedAt: j.completed_at,
  }));
});

// 切换日志面板
function toggleLogs() {
  showLogs.value = !showLogs.value;
}
</script>

<template>
  <div>
    <!-- 头部 -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ data.preset.name }}
        </h2>
        <template v-if="isSubPreset && lockState">
          <UBadge
            color="warning"
            variant="subtle"
            size="sm"
          >
            <UIcon
              name="i-lucide-lock"
              class="w-3 h-3 mr-1"
            />
            已锁定
          </UBadge>
        </template>
      </div>
      <div class="flex items-center gap-2">
        <template v-if="isSubPreset">
          <UButton
            v-if="lockState"
            size="sm"
            variant="ghost"
            color="warning"
            icon="i-lucide-unlock"
            :loading="isUnlocking"
            @click="unlockPreset"
          />
          <UButton
            v-else
            size="sm"
            variant="ghost"
            color="neutral"
            icon="i-lucide-lock"
            :loading="isLocking"
            @click="lockPreset"
          />
        </template>
        <UButton
          color="primary"
          :icon="statusData?.hasRunning ? 'i-lucide-loader' : 'i-lucide-play'"
          :loading="isTriggering"
          :disabled="statusData?.hasRunning"
          @click="triggerRun"
        >
          {{ statusData?.hasRunning ? "运行中" : "运行" }}
        </UButton>
      </div>
    </div>

    <!-- 配置区域 -->
    <div class="space-y-4 mb-4">
      <!-- 分支 -->
      <div class="flex items-center gap-3">
        <UIcon
          name="i-lucide-git-branch"
          class="w-4 h-4 text-gray-400 shrink-0"
        />
        <USelect
          v-if="data.preset.allow_branch_override && data.branches.length > 0"
          v-model="overrideBranch"
          :items="data.branches.map((b) => ({ label: b, value: b }))"
          value-key="value"
          size="sm"
          class="flex-1"
        />
        <span
          v-else
          class="text-sm font-mono text-gray-600 dark:text-gray-400"
        >
          {{ data.preset.branch }}
        </span>
      </div>

      <!-- 参数（紧凑显示） -->
      <div
        v-if="Object.keys(data.preset.inputs || {}).length > 0"
        class="flex items-center gap-3"
      >
        <UIcon
          name="i-lucide-settings"
          class="w-4 h-4 text-gray-400 shrink-0"
        />
        <div class="flex-1 flex items-center gap-2 flex-wrap">
          <span
            v-for="(value, key) in data.preset.inputs"
            :key="key"
            class="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs"
          >
            <span class="text-gray-500">{{ key }}:</span>
            <span class="font-mono">{{ overrideInputs[key] ?? value }}</span>
          </span>
        </div>
        <UButton
          v-if="hasEditableInputs"
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-lucide-pencil"
          @click="openEditInputsModal"
        />
      </div>
    </div>

    <!-- 运行状态 -->
    <div
      v-if="statusData?.run"
      class="mb-4"
    >
      <div
        class="p-3 rounded-lg"
        :class="{
          'bg-blue-50 dark:bg-blue-900/20': jobStatusColor(statusData.run.status, statusData.run.conclusion) === 'info',
          'bg-amber-50 dark:bg-amber-900/20': jobStatusColor(statusData.run.status, statusData.run.conclusion) === 'warning',
          'bg-green-50 dark:bg-green-900/20': jobStatusColor(statusData.run.status, statusData.run.conclusion) === 'success',
          'bg-red-50 dark:bg-red-900/20': jobStatusColor(statusData.run.status, statusData.run.conclusion) === 'error',
          'bg-gray-50 dark:bg-gray-800': jobStatusColor(statusData.run.status, statusData.run.conclusion) === 'neutral',
        }"
      >
        <!-- 状态头 -->
        <div class="flex items-center gap-3">
          <UIcon
            :name="jobStatusIcon(statusData.run.status, statusData.run.conclusion)"
            class="w-5 h-5"
            :class="statusIconClass(statusData.run.status, statusData.run.conclusion)"
          />
          <span class="font-medium">运行 #{{ statusData.run.run_number }}</span>
          <UBadge
            :color="jobStatusColor(statusData.run.status, statusData.run.conclusion) as any"
            variant="subtle"
            size="sm"
          >
            {{ overallStatusLabel(statusData.run.status, statusData.run.conclusion) }}
          </UBadge>
          <span
            v-if="formatDuration(statusData.run.started_at, statusData.run.completed_at)"
            class="text-sm text-gray-400 ml-auto"
          >
            {{ formatDuration(statusData.run.started_at, statusData.run.completed_at) }}
          </span>
          <UButton
            v-if="statusData.run.jobs.length > 0"
            size="xs"
            variant="ghost"
            color="neutral"
            :icon="showLogs ? 'i-lucide-chevron-up' : 'i-lucide-terminal'"
            @click="toggleLogs"
          >
            {{ showLogs ? '收起' : '日志' }}
          </UButton>
          <UButton
            v-if="statusData.run.html_url"
            :to="statusData.run.html_url"
            external
            target="_blank"
            variant="ghost"
            size="xs"
            icon="i-lucide-external-link"
          />
        </div>

        <!-- Jobs 列表（可点击查看日志） -->
        <div
          v-if="statusData.run.jobs.length > 0 && !showLogs"
          class="space-y-1.5 mt-3"
        >
          <button
            v-for="job in statusData.run.jobs"
            :key="job.id"
            class="w-full flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
            @click="showLogs = true"
          >
            <UIcon
              :name="jobStatusIcon(job.status, job.conclusion)"
              class="w-3.5 h-3.5 shrink-0"
              :class="statusIconClass(job.status, job.conclusion)"
            />
            <span class="flex-1 truncate">{{ job.name }}</span>
            <span
              v-if="formatDuration(job.started_at, job.completed_at)"
              class="text-xs text-gray-400"
            >
              {{ formatDuration(job.started_at, job.completed_at) }}
            </span>
          </button>
        </div>
      </div>

      <!-- 日志面板 -->
      <div
        v-if="showLogs && jobsForPanel.length > 0"
        class="mt-3"
      >
        <WorkflowJobLogsPanel
          :owner="repoOwner"
          :repo="repoName"
          :jobs="jobsForPanel"
          compact
          max-height="320px"
        />
      </div>
    </div>

    <!-- 操作日志（折叠） -->
    <div v-if="isSubPreset">
      <UButton
        variant="ghost"
        color="neutral"
        size="xs"
        class="w-full"
        @click="toggleHistory"
      >
        <UIcon
          :name="showHistory ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          class="w-3 h-3 mr-1"
        />
        操作日志
      </UButton>

      <div
        v-if="showHistory"
        class="mt-2"
      >
        <div
          v-if="loadingHistory"
          class="flex items-center justify-center py-4"
        >
          <UIcon
            name="i-lucide-loader"
            class="w-4 h-4 animate-spin text-gray-400"
          />
        </div>
        <div
          v-else-if="historyData.length > 0"
          class="space-y-2 max-h-40 overflow-y-auto"
        >
          <div
            v-for="item in historyData"
            :key="item.id"
            class="flex items-center gap-2 text-xs"
          >
            <UIcon
              :name="actionIcon(item.action)"
              class="w-3 h-3 shrink-0"
              :class="actionColor(item.action)"
            />
            <span class="font-medium">{{ actionLabel(item.action) }}</span>
            <span
              v-if="item.actor_name"
              class="text-gray-400"
            >{{ item.actor_name }}</span>
            <span class="text-gray-400 ml-auto">{{ formatHistoryTime(item.created_at) }}</span>
          </div>
        </div>
        <div
          v-else
          class="text-center text-xs text-gray-400 py-4"
        >
          暂无操作记录
        </div>
      </div>
    </div>
  </div>
</template>
