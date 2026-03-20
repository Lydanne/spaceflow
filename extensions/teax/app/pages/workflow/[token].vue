<script setup lang="ts">
definePageMeta({
  layout: "default",
});

const route = useRoute();
const token = computed(() => route.params.token as string);
const toast = useToast();

interface PresetData {
  preset: {
    id: string;
    name: string;
    workflow_path: string;
    workflow_name: string;
    branch: string;
    inputs: Record<string, string>;
  };
  repository: {
    id: string;
    full_name: string;
    name: string;
  };
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
    jobs: Array<{
      id: number;
      name: string;
      status: string;
      conclusion: string | null;
      started_at: string | null;
      completed_at: string | null;
    }>;
  } | null;
}

// 获取预设信息
const { data: presetData, error: presetError, status: presetStatus } = useLazyFetch<PresetData>(
  () => `/api/workflow-presets/${token.value}`,
);

// 获取运行状态（从数据库读取 current_run_id）
const { data: statusData, refresh: refreshStatus } = useLazyFetch<RunStatus>(
  () => `/api/workflow-presets/${token.value}/status`,
);

// 轮询状态
const pollingInterval = ref<ReturnType<typeof setInterval> | null>(null);

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
  { immediate: true },
);

onUnmounted(() => {
  stopPolling();
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
    await $fetch(`/api/workflow-presets/${token.value}/run`, { method: "POST" });
    toast.add({ title: "工作流已触发", color: "success" });

    // 刷新状态并开始轮询
    await refreshStatus();
    startPolling();
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
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- 加载中 -->
    <div
      v-if="presetStatus === 'pending'"
      class="flex items-center justify-center min-h-screen"
    >
      <UIcon
        name="i-lucide-loader"
        class="w-8 h-8 animate-spin text-primary-500"
      />
    </div>

    <!-- 错误 -->
    <div
      v-else-if="presetError"
      class="flex flex-col items-center justify-center min-h-screen gap-4"
    >
      <UIcon
        name="i-lucide-alert-circle"
        class="w-16 h-16 text-red-500"
      />
      <p class="text-lg text-gray-600 dark:text-gray-400">
        {{ (presetError as { data?: { message?: string } })?.data?.message || "无法加载预设" }}
      </p>
      <UButton
        to="/"
        color="primary"
        variant="soft"
      >
        返回首页
      </UButton>
    </div>

    <!-- 主内容 -->
    <div
      v-else-if="presetData"
      class="max-w-2xl mx-auto px-4 py-12"
    >
      <!-- 头部 -->
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {{ presetData.preset.name }}
        </h1>
        <p class="text-gray-500 dark:text-gray-400">
          {{ presetData.repository.full_name }}
        </p>
      </div>

      <!-- 配置卡片 -->
      <UCard class="mb-6">
        <div class="space-y-4">
          <!-- Workflow -->
          <div class="flex items-center gap-3">
            <UIcon
              name="i-lucide-workflow"
              class="w-5 h-5 text-gray-400 shrink-0"
            />
            <div>
              <p class="text-xs text-gray-400">
                Workflow
              </p>
              <p class="font-medium">
                {{ presetData.preset.workflow_name }}
              </p>
            </div>
          </div>

          <!-- 分支 -->
          <div class="flex items-center gap-3">
            <UIcon
              name="i-lucide-git-branch"
              class="w-5 h-5 text-gray-400 shrink-0"
            />
            <div>
              <p class="text-xs text-gray-400">
                分支
              </p>
              <p class="font-medium font-mono">
                {{ presetData.preset.branch }}
              </p>
            </div>
          </div>

          <!-- 参数 -->
          <div
            v-if="Object.keys(presetData.preset.inputs || {}).length > 0"
            class="border-t border-gray-200 dark:border-gray-700 pt-4"
          >
            <p class="text-xs text-gray-400 mb-3">
              预设参数
            </p>
            <div class="space-y-2">
              <div
                v-for="(value, key) in presetData.preset.inputs"
                :key="key"
                class="flex items-center justify-between text-sm"
              >
                <span class="text-gray-500">{{ key }}</span>
                <span class="font-mono text-gray-900 dark:text-white">{{ value }}</span>
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
            <span
              v-if="formatDuration(statusData.run.started_at, statusData.run.completed_at)"
              class="text-sm text-gray-400"
            >
              {{ formatDuration(statusData.run.started_at, statusData.run.completed_at) }}
            </span>
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

      <!-- 触发按钮 -->
      <div class="text-center">
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
    </div>
  </div>
</template>
