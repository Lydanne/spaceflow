import type { WorkflowRunDetail, JobsResponse } from "~~/server/shared/dto";

export interface RunJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  runner_name?: string | null;
}

export interface QueueStatus {
  status: "waiting" | "running";
  position: number | null;
}

export interface RunStatus {
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
  queueStatus: QueueStatus | null;
}

export interface UseWorkflowStatusOptions {
  statusUrl?: string;
  directMode?: boolean;
  runDetailUrlPrefix?: string;
}

export function useWorkflowStatus(options: UseWorkflowStatusOptions) {
  const statusData = ref<RunStatus | null>(null);
  const pollingInterval = ref<ReturnType<typeof setInterval> | null>(null);
  const currentRunId = ref<number | null>(null);

  async function refreshStatus() {
    try {
      if (options.statusUrl) {
        statusData.value = await $fetch<RunStatus>(options.statusUrl);
      } else if (
        options.directMode
        && currentRunId.value
        && options.runDetailUrlPrefix
      ) {
        const runDetail = await $fetch<WorkflowRunDetail>(
          `${options.runDetailUrlPrefix}/${currentRunId.value}`,
        );

        let jobs: RunJob[] = [];
        try {
          const jobsResult = await $fetch<JobsResponse>(
            `${options.runDetailUrlPrefix}/${currentRunId.value}/jobs`,
          );
          jobs = jobsResult.jobs || [];
        } catch {
          // 忽略
        }

        statusData.value = {
          hasRunning:
            runDetail.status === "running"
            || runDetail.status === "queued"
            || runDetail.status === "waiting",
          run: {
            id: runDetail.id,
            run_number: runDetail.run_number,
            status: runDetail.status,
            conclusion: runDetail.conclusion,
            started_at: runDetail.started_at,
            completed_at: runDetail.completed_at,
            html_url: runDetail.html_url,
            jobs,
          },
          triggeredBy: null,
          queueStatus: null,
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

  function setCurrentRunId(runId: number) {
    currentRunId.value = runId;
  }

  // 初始加载状态
  onMounted(() => {
    if (options.statusUrl) {
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

  return {
    statusData,
    currentRunId,
    refreshStatus,
    startPolling,
    stopPolling,
    setCurrentRunId,
  };
}

// 状态颜色
export function jobStatusColor(status: string, conclusion: string | null): string {
  if (status === "queued" || status === "waiting") return "info";
  if (status === "running" || status === "in_progress") return "warning";
  if (conclusion === "success") return "success";
  if (conclusion === "failure") return "error";
  if (conclusion === "cancelled") return "neutral";
  return "info";
}

// 状态图标
export function jobStatusIcon(status: string, conclusion: string | null): string {
  if (status === "queued" || status === "waiting") return "i-lucide-clock";
  if (status === "running" || status === "in_progress") return "i-lucide-loader";
  if (conclusion === "success") return "i-lucide-check-circle";
  if (conclusion === "failure") return "i-lucide-x-circle";
  if (conclusion === "cancelled") return "i-lucide-ban";
  return "i-lucide-circle-dot";
}

// 状态标签
export function overallStatusLabel(status: string, conclusion: string | null): string {
  if (status === "queued") return "排队中";
  if (status === "waiting") return "等待中";
  if (status === "running" || status === "in_progress") return "运行中";
  if (conclusion === "success") return "成功";
  if (conclusion === "failure") return "失败";
  if (conclusion === "cancelled") return "已取消";
  return "未知";
}

// 格式化持续时间
export function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt || !completedAt) return "";
  const seconds = Math.round(
    (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000,
  );
  if (seconds < 0) return "";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
