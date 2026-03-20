<script setup lang="ts">
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
    name: string;
    workflow_path: string;
    workflow_name: string;
    branch: string;
    inputs: Record<string, string>;
    allow_input_override: boolean;
    allow_branch_override: boolean;
  };
  inputDefs: Record<string, WorkflowInputDef>;
  branches: string[];
  repository: {
    id: string;
    full_name: string;
    name: string;
  };
}

interface RunJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface RunStatus {
  hasRunning: boolean;
  run: {
    id: number;
    run_number: number;
    status: string;
    conclusion: string | null;
    started_at: string | null;
    completed_at: string | null;
    html_url: string | null;
    jobs: RunJob[];
  } | null;
  triggeredBy: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
}

const props = defineProps<{
  data: PresetData;
  statusUrl?: string;
  runUrl: string;
  // 直接触发模式：发送 workflow_id 和 ref 而不是 inputs 和 branch
  directMode?: boolean;
  // 直接模式下获取运行详情的 URL 前缀，如 /api/repos/owner/repo/actions/runs
  runDetailUrlPrefix?: string;
  // 嵌入模式：用于 Tab 内显示，使用紧凑布局
  embedded?: boolean;
}>();

const toast = useToast();

// 获取运行状态
const statusData = ref<RunStatus | null>(null);
const pollingInterval = ref<ReturnType<typeof setInterval> | null>(null);
const currentRunId = ref<number | null>(null);

async function refreshStatus() {
  try {
    if (props.statusUrl) {
      // 预设模式：使用 statusUrl
      statusData.value = await $fetch<RunStatus>(props.statusUrl);
    } else if (props.directMode && currentRunId.value && props.runDetailUrlPrefix) {
      // 直接模式：使用 runDetailUrlPrefix + runId
      const runDetail = await $fetch<{
        id: number;
        runNumber: number;
        status: string;
        conclusion: string | null;
        startedAt: string | null;
        completedAt: string | null;
        htmlUrl: string | null;
      }>(`${props.runDetailUrlPrefix}/${currentRunId.value}`);

      // 获取 jobs
      let jobs: RunJob[] = [];
      try {
        const jobsResult = await $fetch<{ jobs: RunJob[] }>(
          `${props.runDetailUrlPrefix}/${currentRunId.value}/jobs`,
        );
        jobs = jobsResult.jobs || [];
      } catch {
        // 忽略
      }

      statusData.value = {
        hasRunning: runDetail.status === "running" || runDetail.status === "queued" || runDetail.status === "waiting",
        run: {
          id: runDetail.id,
          run_number: runDetail.runNumber,
          status: runDetail.status,
          conclusion: runDetail.conclusion,
          started_at: runDetail.startedAt,
          completed_at: runDetail.completedAt,
          html_url: runDetail.htmlUrl,
          jobs,
        },
        triggeredBy: null,
      };
    }
  } catch {
    // 忽略
  }
}

function startPolling() {
  stopPolling();
  pollingInterval.value = setInterval(() => {
    refreshStatus();
  }, 3000);
}

function stopPolling() {
  if (pollingInterval.value) {
    clearInterval(pollingInterval.value);
    pollingInterval.value = null;
  }
}

// 初始加载状态
onMounted(() => {
  if (props.statusUrl) {
    refreshStatus();
  }
});

// 当有运行中的任务时开始轮询
watch(
  () => statusData.value?.hasRunning,
  (hasRunning) => {
    if (hasRunning) {
      startPolling();
    } else {
      stopPolling();
    }
  },
);

onUnmounted(() => {
  stopPolling();
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
  tempInputs.value = { ...overrideInputs.value };
  showEditInputsModal.value = true;
}

function saveInputs() {
  overrideInputs.value = { ...tempInputs.value };
  showEditInputsModal.value = false;
}

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
      // 直接触发模式：发送 workflow_id, ref, inputs
      body = {
        workflow_id: props.data.preset.workflow_path,
        ref: overrideBranch.value,
        inputs: overrideInputs.value,
      };
    } else {
      // 预设模式：发送 inputs 和 branch（可选）
      body = {};
      if (props.data.preset.allow_input_override) {
        body.inputs = overrideInputs.value;
      }
      if (props.data.preset.allow_branch_override) {
        body.branch = overrideBranch.value;
      }
    }
    const result = await $fetch<{ success: boolean; run_id?: number }>(props.runUrl, { method: "POST", body });
    toast.add({ title: "工作流已触发", color: "success" });

    // 保存 run_id 并开始轮询
    if (result.run_id) {
      currentRunId.value = result.run_id;
    }

    // 刷新状态并开始轮询
    if (props.statusUrl || (props.directMode && result.run_id && props.runDetailUrlPrefix)) {
      await refreshStatus();
      startPolling();
    }
  } catch (err: unknown) {
    const msg = (err as { data?: { message?: string } })?.data?.message || "触发失败";
    toast.add({ title: msg, color: "error" });
  } finally {
    isTriggering.value = false;
  }
}

// 状态颜色和图标
function jobStatusColor(status: string, conclusion: string | null): string {
  if (status === "queued" || status === "waiting") return "info";
  if (status === "running" || status === "in_progress") return "warning";
  if (conclusion === "success") return "success";
  if (conclusion === "failure") return "error";
  if (conclusion === "cancelled") return "neutral";
  return "info";
}

function jobStatusIcon(status: string, conclusion: string | null): string {
  if (status === "queued" || status === "waiting") return "i-lucide-clock";
  if (status === "running" || status === "in_progress") return "i-lucide-loader";
  if (conclusion === "success") return "i-lucide-check-circle";
  if (conclusion === "failure") return "i-lucide-x-circle";
  if (conclusion === "cancelled") return "i-lucide-ban";
  return "i-lucide-circle-dot";
}

function overallStatusLabel(status: string, conclusion: string | null): string {
  if (status === "queued") return "排队中";
  if (status === "waiting") return "等待中";
  if (status === "running" || status === "in_progress") return "运行中";
  if (conclusion === "success") return "成功";
  if (conclusion === "failure") return "失败";
  if (conclusion === "cancelled") return "已取消";
  return "未知";
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt || !completedAt) return "";
  const seconds = Math.round(
    (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000,
  );
  if (seconds < 0) return "";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
</script>

<template>
  <div :class="embedded ? '' : 'max-w-2xl mx-auto px-4 py-12'">
    <!-- 头部 - 嵌入模式 -->
    <div
      v-if="embedded"
      class="flex items-center justify-between mb-6"
    >
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

    <!-- 头部 - 独立页面模式 -->
    <div
      v-else
      class="text-center mb-8"
    >
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        {{ data.preset.name }}
      </h1>
      <p class="text-gray-500 dark:text-gray-400">
        {{ data.repository.full_name }}
      </p>
    </div>

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
            <p class="text-xs text-gray-400 mb-1">
              分支
            </p>
            <USelect
              v-if="data.preset.allow_branch_override && data.branches.length > 0"
              v-model="overrideBranch"
              :items="data.branches.map((b) => ({ label: b, value: b }))"
              value-key="value"
              class="w-full"
            />
            <p
              v-else
              class="font-medium font-mono"
            >
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
            <p class="text-xs text-gray-400">
              预设参数
            </p>
            <UButton
              v-if="data.preset.allow_input_override"
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
            <div
              v-for="(value, key) in data.preset.inputs"
              :key="key"
            >
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-500">{{ key }}</span>
                <span class="font-mono text-gray-900 dark:text-white">{{ overrideInputs[key] ?? value }}</span>
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
    <div
      v-if="statusData?.run"
      class="mb-6"
    >
      <UCard>
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <UIcon
              :name="jobStatusIcon(statusData.run.status, statusData.run.conclusion)"
              class="w-5 h-5"
              :class="{
                'text-blue-500': jobStatusColor(statusData.run.status, statusData.run.conclusion) === 'info',
                'text-amber-500 animate-spin': jobStatusColor(statusData.run.status, statusData.run.conclusion) === 'warning',
                'text-green-500': jobStatusColor(statusData.run.status, statusData.run.conclusion) === 'success',
                'text-red-500': jobStatusColor(statusData.run.status, statusData.run.conclusion) === 'error',
                'text-gray-400': jobStatusColor(statusData.run.status, statusData.run.conclusion) === 'neutral',
              }"
            />
            <span class="font-medium">
              运行 #{{ statusData.run.run_number }}
            </span>
            <UBadge
              :color="jobStatusColor(statusData.run.status, statusData.run.conclusion) as any"
              variant="subtle"
              size="sm"
            >
              {{ overallStatusLabel(statusData.run.status, statusData.run.conclusion) }}
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
              v-if="formatDuration(statusData.run.started_at, statusData.run.completed_at)"
              class="text-sm text-gray-400"
            >
              {{ formatDuration(statusData.run.started_at, statusData.run.completed_at) }}
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
        <div
          v-if="statusData.run.jobs.length > 0"
          class="space-y-2"
        >
          <div
            v-for="job in statusData.run.jobs"
            :key="job.id"
            class="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
          >
            <UIcon
              :name="jobStatusIcon(job.status, job.conclusion)"
              class="w-4 h-4 shrink-0"
              :class="{
                'text-blue-500': jobStatusColor(job.status, job.conclusion) === 'info',
                'text-amber-500 animate-spin': jobStatusColor(job.status, job.conclusion) === 'warning',
                'text-green-500': jobStatusColor(job.status, job.conclusion) === 'success',
                'text-red-500': jobStatusColor(job.status, job.conclusion) === 'error',
                'text-gray-400': jobStatusColor(job.status, job.conclusion) === 'neutral',
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
    <div
      v-if="!embedded"
      class="text-center"
    >
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
      <p
        v-if="statusData?.hasRunning"
        class="text-sm text-gray-400 mt-2"
      >
        请等待当前运行完成
      </p>
    </div>

    <!-- 修改参数弹窗 -->
    <UModal v-model:open="showEditInputsModal">
      <template #content>
        <div class="p-6 space-y-4">
          <h3 class="text-lg font-semibold">
            修改运行参数
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            修改参数值后点击保存，下次运行将使用新的参数
          </p>

          <WorkflowInputsForm
            v-model="tempInputs"
            :input-defs="data.inputDefs"
          />

          <div class="flex justify-end gap-2 pt-2">
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
