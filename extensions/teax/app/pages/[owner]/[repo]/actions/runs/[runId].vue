<script setup lang="ts">
import type { JobInfo } from "~/components/workflow/JobLogsPanel.vue";
import type { WorkflowRunDetail, JobsResponse } from "~~/server/shared/dto";

const props = defineProps<{
  owner: string;
  repo: string;
}>();

const route = useRoute();
const runId = computed(() => route.params.runId as string);

const {
  data: runData,
  status: runStatus,
  error: runError,
} = useLazyFetch<WorkflowRunDetail>(
  () => `/api/repos/${props.owner}/${props.repo}/actions/runs/${runId.value}`,
);

const {
  data: jobsData,
  status: jobsStatus,
} = useLazyFetch<JobsResponse>(
  () => `/api/repos/${props.owner}/${props.repo}/actions/runs/${runId.value}/jobs`,
);

const jobs = computed<JobInfo[]>(() => jobsData.value?.jobs ?? []);
const isLoading = computed(() => runStatus.value === "pending" || jobsStatus.value === "pending");

// 辅助函数
function runStatusColor(status: string, conclusion: string | null): string {
  if (status === "queued" || status === "waiting") return "info";
  if (status === "running" || status === "in_progress") return "warning";
  if (conclusion === "success") return "success";
  if (conclusion === "failure") return "error";
  if (conclusion === "cancelled") return "neutral";
  return "info";
}

function runStatusLabel(status: string, conclusion: string | null): string {
  if (status === "queued") return "排队中";
  if (status === "waiting") return "等待中";
  if (status === "running" || status === "in_progress") return "运行中";
  if (conclusion === "success") return "成功";
  if (conclusion === "failure") return "失败";
  if (conclusion === "cancelled") return "已取消";
  if (conclusion === "skipped") return "已跳过";
  return status || "未知";
}

function runStatusIcon(status: string, conclusion: string | null): string {
  if (status === "queued" || status === "waiting") return "i-lucide-clock";
  if (status === "running" || status === "in_progress") return "i-lucide-loader";
  if (conclusion === "success") return "i-lucide-check-circle";
  if (conclusion === "failure") return "i-lucide-x-circle";
  if (conclusion === "cancelled") return "i-lucide-ban";
  if (conclusion === "skipped") return "i-lucide-skip-forward";
  return "i-lucide-circle-dot";
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

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (date.getFullYear() <= 1970) return "";
  const now = Date.now();
  const diff = Math.round((now - date.getTime()) / 1000);
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`;
  return date.toLocaleDateString("zh-CN");
}

function eventLabel(event: string): string {
  const map: Record<string, string> = {
    push: "推送",
    pull_request: "PR",
    workflow_dispatch: "手动触发",
    schedule: "定时",
    release: "发布",
  };
  return map[event] || event;
}
</script>

<template>
  <div>
    <!-- 返回按钮 -->
    <div class="mb-4">
      <UButton
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        size="sm"
        :to="`/${props.owner}/${props.repo}/actions`"
      >
        返回 Actions
      </UButton>
    </div>

    <!-- 加载中 -->
    <div
      v-if="isLoading"
      class="flex justify-center py-12"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-6 h-6 animate-spin text-gray-400"
      />
    </div>

    <!-- 错误 -->
    <div
      v-else-if="runError"
      class="text-center py-12 text-gray-400"
    >
      <UIcon
        name="i-lucide-alert-circle"
        class="w-12 h-12 mx-auto mb-3 text-red-400"
      />
      <p>加载 Run 详情失败</p>
    </div>

    <!-- Run 详情 -->
    <template v-else-if="runData">
      <!-- Run 头部信息 -->
      <div class="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-5 py-4">
        <div class="flex items-start justify-between">
          <div class="flex items-start gap-3">
            <UIcon
              :name="runStatusIcon(runData.status, runData.conclusion)"
              class="w-6 h-6 mt-0.5 shrink-0"
              :class="{
                'text-blue-500': runStatusColor(runData.status, runData.conclusion) === 'info',
                'text-amber-500 animate-spin': runStatusColor(runData.status, runData.conclusion) === 'warning',
                'text-green-500': runStatusColor(runData.status, runData.conclusion) === 'success',
                'text-red-500': runStatusColor(runData.status, runData.conclusion) === 'error',
                'text-gray-400': runStatusColor(runData.status, runData.conclusion) === 'neutral',
              }"
            />
            <div>
              <h2 class="text-lg font-semibold">
                {{ runData.display_title }}
                <span class="text-sm font-normal text-gray-400 ml-2">#{{ runData.run_number }}</span>
              </h2>
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-500 dark:text-gray-400">
                <UBadge
                  :color="runStatusColor(runData.status, runData.conclusion) as any"
                  variant="subtle"
                  size="sm"
                >
                  {{ runStatusLabel(runData.status, runData.conclusion) }}
                </UBadge>
                <span class="flex items-center gap-1">
                  <UIcon
                    name="i-lucide-git-branch"
                    class="w-4 h-4"
                  />
                  {{ runData.head_branch }}
                </span>
                <span class="font-mono text-xs">{{ runData.head_sha?.substring(0, 7) }}</span>
                <UBadge
                  color="neutral"
                  variant="subtle"
                  size="xs"
                >
                  {{ eventLabel(runData.event) }}
                </UBadge>
                <span
                  v-if="runData.actor"
                  class="flex items-center gap-1"
                >
                  <UIcon
                    name="i-lucide-user"
                    class="w-4 h-4"
                  />
                  {{ runData.actor.login }}
                </span>
                <span
                  v-if="relativeTime(runData.started_at)"
                  class="flex items-center gap-1"
                >
                  <UIcon
                    name="i-lucide-clock"
                    class="w-4 h-4"
                  />
                  {{ relativeTime(runData.started_at) }}
                </span>
                <span
                  v-if="formatDuration(runData.started_at, runData.completed_at)"
                  class="flex items-center gap-1"
                >
                  <UIcon
                    name="i-lucide-timer"
                    class="w-4 h-4"
                  />
                  {{ formatDuration(runData.started_at, runData.completed_at) }}
                </span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <!-- <UButton
              v-if="isRunActive"
              icon="i-lucide-square"
              color="error"
              variant="soft"
              size="sm"
              :loading="cancelling"
              @click="cancelRun"
            >
              停止
            </UButton>
            <UButton
              v-if="!isRunActive"
              icon="i-lucide-rotate-ccw"
              color="primary"
              variant="soft"
              size="sm"
              :loading="rerunning"
              @click="rerunRun"
            >
              重新运行
            </UButton> -->
            <a
              :href="runData.html_url"
              target="_blank"
              rel="noopener noreferrer"
            >
              <UButton
                icon="i-lucide-external-link"
                color="neutral"
                variant="ghost"
                size="sm"
              >
                Gitea
              </UButton>
            </a>
          </div>
        </div>
      </div>

      <!-- Jobs + 日志面板 -->
      <WorkflowJobLogsPanel
        :owner="props.owner"
        :repo="props.repo"
        :jobs="jobs"
      />
    </template>
  </div>
</template>

<style scoped>
:deep(pre) a {
  color: #93c5fd;
  text-decoration: underline;
}
</style>
