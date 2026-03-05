<script setup lang="ts">
const route = useRoute();
const orgId = route.params.orgId as string;
const projectId = route.params.projectId as string;
const taskId = route.params.taskId as string;

interface TaskDetail {
  id: string;
  branch: string;
  commitSha: string;
  commitMessage: string | null;
  triggeredBy: string | null;
  triggerType: string;
  status: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  duration: number | null;
  logUrl: string | null;
  createdAt: string;
  triggeredByUsername: string | null;
}

interface LogItem {
  id: number;
  taskId: string;
  timestamp: string;
  level: string;
  step: string | null;
  message: string;
}

const {
  data: task,
  status: taskStatus,
  refresh: refreshTask,
} = await useFetch<TaskDetail>(
  `/api/orgs/${orgId}/projects/${projectId}/publish/${taskId}`,
);

const logs = ref<LogItem[]>([]);
const logCursor = ref(0);
const loadingLogs = ref(false);

async function fetchLogs() {
  loadingLogs.value = true;
  try {
    const result = await $fetch<{
      data: LogItem[];
      cursor: number;
      hasMore: boolean;
    }>(`/api/orgs/${orgId}/projects/${projectId}/publish/${taskId}/logs`, {
      query: { cursor: logCursor.value, limit: 100 },
    });
    if (result.data.length > 0) {
      logs.value = [...logs.value, ...result.data];
      logCursor.value = result.cursor;
    }
  } catch {
    // 日志加载失败不中断页面
  } finally {
    loadingLogs.value = false;
  }
}

async function pollLogsAndStatus() {
  await Promise.all([fetchLogs(), refreshTask()]);
}

// 初始加载日志
await fetchLogs();

// 运行中的任务轮询日志 + 任务状态
let pollTimer: ReturnType<typeof setInterval> | null = null;

watch(
  () => task.value?.status,
  (status) => {
    if (status === "running" || status === "pending") {
      if (!pollTimer) {
        pollTimer = setInterval(pollLogsAndStatus, 3000);
      }
    } else {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
});

function statusColor(status: string | null): string {
  switch (status) {
    case "running":
      return "warning";
    case "success":
      return "success";
    case "failed":
      return "error";
    case "cancelled":
      return "neutral";
    default:
      return "info";
  }
}

function statusLabel(status: string | null): string {
  switch (status) {
    case "pending":
      return "等待中";
    case "approved":
      return "已批准";
    case "running":
      return "运行中";
    case "success":
      return "成功";
    case "failed":
      return "失败";
    case "cancelled":
      return "已取消";
    default:
      return status || "未知";
  }
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "-";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function logLevelClass(level: string): string {
  switch (level) {
    case "error":
      return "text-red-500";
    case "warn":
      return "text-yellow-500";
    case "info":
      return "text-blue-400";
    case "debug":
      return "text-gray-500";
    default:
      return "text-gray-300";
  }
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-8">
    <div
      v-if="taskStatus === 'pending'"
      class="flex justify-center py-12"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-6 h-6 animate-spin text-gray-400"
      />
    </div>

    <template v-else-if="task">
      <!-- 头部 -->
      <div class="flex items-center gap-3 mb-6">
        <UButton
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="ghost"
          size="sm"
          :to="`/orgs/${orgId}/projects/${projectId}`"
        />
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <h1 class="text-xl font-bold">
              发布详情
            </h1>
            <UBadge
              :color="statusColor(task.status) as any"
              variant="subtle"
            >
              {{ statusLabel(task.status) }}
            </UBadge>
          </div>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {{ task.commitSha?.substring(0, 7) }} · {{ task.branch }}
          </p>
        </div>
      </div>

      <!-- 任务信息 -->
      <UCard class="mb-6">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p class="text-gray-500 dark:text-gray-400">
              触发方式
            </p>
            <p class="font-medium mt-0.5">
              {{ task.triggerType === "manual" ? "手动" : "Webhook" }}
            </p>
          </div>
          <div>
            <p class="text-gray-500 dark:text-gray-400">
              触发人
            </p>
            <p class="font-medium mt-0.5">
              {{ task.triggeredByUsername || "-" }}
            </p>
          </div>
          <div>
            <p class="text-gray-500 dark:text-gray-400">
              创建时间
            </p>
            <p class="font-medium mt-0.5">
              {{ new Date(task.createdAt).toLocaleString("zh-CN") }}
            </p>
          </div>
          <div>
            <p class="text-gray-500 dark:text-gray-400">
              耗时
            </p>
            <p class="font-medium mt-0.5">
              {{ formatDuration(task.duration) }}
            </p>
          </div>
        </div>
        <div
          v-if="task.commitMessage"
          class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800"
        >
          <p class="text-gray-500 dark:text-gray-400 text-sm">
            Commit 信息
          </p>
          <p class="mt-0.5">
            {{ task.commitMessage }}
          </p>
        </div>
      </UCard>

      <!-- 日志 -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold">
              构建日志
            </h2>
            <UButton
              v-if="task.status === 'running' || task.status === 'pending'"
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-refresh-cw"
              :loading="loadingLogs"
              @click="fetchLogs"
            >
              刷新
            </UButton>
          </div>
        </template>

        <div
          v-if="logs.length > 0"
          class="bg-gray-950 rounded-lg p-4 font-mono text-xs max-h-[500px] overflow-y-auto"
        >
          <div
            v-for="log in logs"
            :key="log.id"
            class="flex gap-2 leading-5"
          >
            <span class="text-gray-600 shrink-0 select-none">
              {{ new Date(log.timestamp).toLocaleTimeString("zh-CN") }}
            </span>
            <span
              v-if="log.step"
              class="text-purple-400 shrink-0"
            >
              [{{ log.step }}]
            </span>
            <span :class="logLevelClass(log.level)">
              {{ log.message }}
            </span>
          </div>
        </div>

        <div
          v-else
          class="text-center py-8 text-gray-400 text-sm"
        >
          <template v-if="task.status === 'pending'">
            等待构建开始...
          </template>
          <template v-else>
            暂无日志
          </template>
        </div>
      </UCard>
    </template>
  </div>
</template>
