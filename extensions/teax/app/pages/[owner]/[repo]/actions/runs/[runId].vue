<script setup lang="ts">
import AnsiToHtml from "ansi-to-html";

const props = defineProps<{
  owner: string;
  repo: string;
}>();

const route = useRoute();
const runId = computed(() => route.params.runId as string);

interface JobItem {
  id: number;
  runId: number;
  name: string;
  status: string;
  conclusion: string;
  startedAt: string;
  completedAt: string | null;
  runnerName: string | null;
  labels: string[];
  steps: unknown[];
}

interface RunDetail {
  id: number;
  runNumber: number;
  displayTitle: string;
  status: string;
  conclusion: string;
  event: string;
  headBranch: string;
  headSha: string;
  path: string;
  htmlUrl: string;
  startedAt: string;
  completedAt: string | null;
  workflowId: number;
  actor: { login: string; avatar_url: string } | null;
}

const {
  data: runData,
  status: runStatus,
  error: runError,
} = useLazyFetch<RunDetail>(
  () => `/api/repos/${props.owner}/${props.repo}/actions/runs/${runId.value}`,
);

const {
  data: jobsData,
  status: jobsStatus,
} = useLazyFetch<{ total: number; data: JobItem[] }>(
  () => `/api/repos/${props.owner}/${props.repo}/actions/runs/${runId.value}/jobs`,
);

const jobs = computed(() => jobsData.value?.data ?? []);
const isLoading = computed(() => runStatus.value === "pending" || jobsStatus.value === "pending");

// 当前选中的 Job
const activeJobId = ref<number | null>(null);
watch(jobs, (list) => {
  const first = list[0];
  if (first && !activeJobId.value) {
    activeJobId.value = first.id;
  }
}, { immediate: true });

const activeJob = computed(() => jobs.value.find((j) => j.id === activeJobId.value) ?? null);

// Job 日志
const jobLogs = ref<Record<number, string>>({});
const jobLogsLoading = ref<Record<number, boolean>>({});

async function fetchJobLogs(jobId: number) {
  if (jobLogs.value[jobId] || jobLogsLoading.value[jobId]) return;
  jobLogsLoading.value[jobId] = true;
  try {
    const text = await $fetch<string>(
      `/api/repos/${props.owner}/${props.repo}/actions/jobs/${jobId}/logs`,
      { responseType: "text" },
    );
    jobLogs.value[jobId] = text;
  } catch {
    jobLogs.value[jobId] = "Failed to load logs.";
  } finally {
    jobLogsLoading.value[jobId] = false;
  }
}

// 选中 job 后自动加载日志
watch(activeJobId, (id) => {
  if (id) fetchJobLogs(id);
}, { immediate: true });

// ANSI → HTML
const ansiConverter = new AnsiToHtml({
  fg: "#d4d4d4",
  bg: "transparent",
  newline: true,
  escapeXML: true,
});

const activeJobLogHtml = computed(() => {
  if (!activeJobId.value) return "";
  const raw = jobLogs.value[activeJobId.value];
  if (!raw) return "";
  return ansiConverter.toHtml(raw);
});

// Step 折叠状态
const expandedSteps = ref<Set<number>>(new Set());
function toggleStep(stepIndex: number) {
  if (expandedSteps.value.has(stepIndex)) {
    expandedSteps.value.delete(stepIndex);
  } else {
    expandedSteps.value.add(stepIndex);
  }
}

interface ParsedStep {
  name: string;
  logHtml: string;
  logRaw: string;
}

// 从日志文本中解析 Steps（基于 "⭐ Run" 标记）
const parsedSteps = computed<ParsedStep[]>(() => {
  if (!activeJobId.value) return [];
  const raw = jobLogs.value[activeJobId.value];
  if (!raw) return [];

  const lines = raw.split("\n");
  const steps: { name: string; lines: string[] }[] = [];
  let current: { name: string; lines: string[] } = { name: "Set up job", lines: [] };

  for (const line of lines) {
    // 匹配 "⭐ Run Main StepName" 或 "⭐ Run Post StepName"
    const stepMatch = line.match(/⭐\s+Run\s+(Main|Post|Pre)\s+(.+)/);
    if (stepMatch) {
      if (current.lines.length > 0 || steps.length === 0) {
        steps.push(current);
      }
      const phase = stepMatch[1] === "Main" ? "" : `[${stepMatch[1] ?? ""}] `;
      current = { name: `${phase}${(stepMatch[2] ?? "").trim()}`, lines: [] };
      continue;
    }

    // 过滤 ::group:: / ::endgroup:: 标记，保留其余日志
    if (/::endgroup::/.test(line)) continue;
    const groupMatch = line.match(/::group::(.*)/);
    if (groupMatch) {
      current.lines.push(groupMatch[1] ?? "");
      continue;
    }

    current.lines.push(line);
  }
  // 推入最后一个 step
  if (current.lines.length > 0) {
    steps.push(current);
  }

  return steps.map((s) => {
    const raw = s.lines.join("\n");
    return {
      name: s.name,
      logRaw: raw,
      logHtml: ansiConverter.toHtml(raw),
    };
  });
});

// 复制日志
const copiedId = ref<string | null>(null);
async function copyLogs(text: string, id: string) {
  try {
    await navigator.clipboard.writeText(text);
    copiedId.value = id;
    setTimeout(() => {
      copiedId.value = null;
    }, 2000);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    copiedId.value = id;
    setTimeout(() => {
      copiedId.value = null;
    }, 2000);
  }
}

function getActiveJobRawLogs(): string {
  if (!activeJobId.value) return "";
  return jobLogs.value[activeJobId.value] || "";
}

// 停止 Run
const cancelling = ref(false);
const isRunActive = computed(() => {
  if (!runData.value) return false;
  const s = runData.value.status;
  return s === "queued" || s === "waiting" || s === "running" || s === "in_progress";
});

async function cancelRun() {
  if (!runData.value || cancelling.value) return;
  cancelling.value = true;
  try {
    await $fetch(
      `/api/repos/${props.owner}/${props.repo}/actions/runs/${runId.value}/cancel`,
      { method: "POST" },
    );
    if (runData.value) {
      runData.value.status = "completed";
      runData.value.conclusion = "cancelled";
    }
  } catch {
    // ignore
  } finally {
    cancelling.value = false;
  }
}

// 重新运行 Run
const rerunning = ref(false);

async function rerunRun() {
  if (!runData.value || rerunning.value) return;
  rerunning.value = true;
  try {
    await $fetch(
      `/api/repos/${props.owner}/${props.repo}/actions/runs/${runId.value}/rerun`,
      { method: "POST" },
    );
    if (runData.value) {
      runData.value.status = "queued";
      runData.value.conclusion = "";
      runData.value.completedAt = null;
    }
  } catch {
    // ignore
  } finally {
    rerunning.value = false;
  }
}

// 辅助函数
function runStatusColor(status: string, conclusion: string): string {
  if (status === "queued" || status === "waiting") return "info";
  if (status === "running" || status === "in_progress") return "warning";
  if (conclusion === "success") return "success";
  if (conclusion === "failure") return "error";
  if (conclusion === "cancelled") return "neutral";
  return "info";
}

function runStatusLabel(status: string, conclusion: string): string {
  if (status === "queued") return "排队中";
  if (status === "waiting") return "等待中";
  if (status === "running" || status === "in_progress") return "运行中";
  if (conclusion === "success") return "成功";
  if (conclusion === "failure") return "失败";
  if (conclusion === "cancelled") return "已取消";
  if (conclusion === "skipped") return "已跳过";
  return status || "未知";
}

function runStatusIcon(status: string, conclusion: string): string {
  if (status === "queued" || status === "waiting") return "i-lucide-clock";
  if (status === "running" || status === "in_progress") return "i-lucide-loader";
  if (conclusion === "success") return "i-lucide-check-circle";
  if (conclusion === "failure") return "i-lucide-x-circle";
  if (conclusion === "cancelled") return "i-lucide-ban";
  if (conclusion === "skipped") return "i-lucide-skip-forward";
  return "i-lucide-circle-dot";
}

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return "";
  const seconds = Math.round(
    (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000,
  );
  if (seconds < 0) return "";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function relativeTime(dateStr: string): string {
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
                {{ runData.displayTitle }}
                <span class="text-sm font-normal text-gray-400 ml-2">#{{ runData.runNumber }}</span>
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
                  {{ runData.headBranch }}
                </span>
                <span class="font-mono text-xs">{{ runData.headSha?.substring(0, 7) }}</span>
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
                  v-if="relativeTime(runData.startedAt)"
                  class="flex items-center gap-1"
                >
                  <UIcon
                    name="i-lucide-clock"
                    class="w-4 h-4"
                  />
                  {{ relativeTime(runData.startedAt) }}
                </span>
                <span
                  v-if="formatDuration(runData.startedAt, runData.completedAt)"
                  class="flex items-center gap-1"
                >
                  <UIcon
                    name="i-lucide-timer"
                    class="w-4 h-4"
                  />
                  {{ formatDuration(runData.startedAt, runData.completedAt) }}
                </span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <UButton
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
            </UButton>
            <a
              :href="runData.htmlUrl"
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
      <div class="flex gap-4" style="min-height: 400px">
        <!-- 左侧: Jobs 列表 -->
        <div class="w-64 shrink-0">
          <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Jobs
          </h3>
          <nav class="space-y-1">
            <button
              v-for="job in jobs"
              :key="job.id"
              class="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left"
              :class="
                activeJobId === job.id
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              "
              @click="activeJobId = job.id"
            >
              <UIcon
                :name="runStatusIcon(job.status, job.conclusion)"
                class="w-4 h-4 shrink-0"
                :class="{
                  'text-blue-500': runStatusColor(job.status, job.conclusion) === 'info',
                  'text-amber-500 animate-spin': runStatusColor(job.status, job.conclusion) === 'warning',
                  'text-green-500': runStatusColor(job.status, job.conclusion) === 'success',
                  'text-red-500': runStatusColor(job.status, job.conclusion) === 'error',
                  'text-gray-400': runStatusColor(job.status, job.conclusion) === 'neutral',
                }"
              />
              <span class="truncate flex-1">{{ job.name }}</span>
              <span
                v-if="formatDuration(job.startedAt, job.completedAt)"
                class="text-xs text-gray-400 shrink-0"
              >
                {{ formatDuration(job.startedAt, job.completedAt) }}
              </span>
            </button>
          </nav>
        </div>

        <!-- 右侧: 日志面板 -->
        <div class="flex-1 min-w-0">
          <template v-if="activeJob">
            <!-- Job 标题 -->
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ activeJob.name }}
              </h3>
              <div class="flex items-center gap-2 text-xs text-gray-400">
                <span
                  v-if="activeJob.runnerName"
                  class="flex items-center gap-1"
                >
                  <UIcon
                    name="i-lucide-server"
                    class="w-3.5 h-3.5"
                  />
                  {{ activeJob.runnerName }}
                </span>
                <span v-if="formatDuration(activeJob.startedAt, activeJob.completedAt)">
                  {{ formatDuration(activeJob.startedAt, activeJob.completedAt) }}
                </span>
                <div class="flex justify-end">
                  <UButton
                    :icon="copiedId === 'all' ? 'i-lucide-check' : 'i-lucide-copy'"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    :label="copiedId === 'all' ? '已复制' : '复制日志'"
                    @click="copyLogs(getActiveJobRawLogs(), 'all')"
                  />
                </div>
              </div>
            </div>

            <!-- 加载中 -->
            <div
              v-if="jobLogsLoading[activeJob.id]"
              class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-900 text-gray-200 px-4 py-3"
            >
              <div class="flex items-center gap-2 text-gray-400 text-sm">
                <UIcon
                  name="i-lucide-loader-2"
                  class="w-4 h-4 animate-spin"
                />
                加载日志中...
              </div>
            </div>

            <!-- Steps 折叠列表（从日志文本中解析） -->
            <div
              v-else-if="parsedSteps.length > 0"
              class="space-y-2"
            >
              <div class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div
                  v-for="(step, idx) in parsedSteps"
                  :key="idx"
                  class="border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                >
                  <!-- Step 头部 -->
                  <div class="flex items-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <button
                      class="flex-1 flex items-center gap-2 px-4 py-2.5 text-sm text-left"
                      @click="toggleStep(idx)"
                    >
                      <UIcon
                        :name="expandedSteps.has(idx) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                        class="w-4 h-4 text-gray-400 shrink-0"
                      />
                      <span class="flex-1 truncate">{{ step.name }}</span>
                      <span class="text-xs text-gray-400 shrink-0">
                        Step {{ idx + 1 }}
                      </span>
                    </button>
                    <UButton
                      :icon="copiedId === `step-${idx}` ? 'i-lucide-check' : 'i-lucide-copy'"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      class="mr-2 shrink-0"
                      @click.stop="copyLogs(step.logRaw, `step-${idx}`)"
                    />
                  </div>

                  <!-- Step 日志内容 -->
                  <div
                    v-if="expandedSteps.has(idx)"
                    class="bg-gray-900 text-gray-200 px-4 py-3 overflow-x-auto"
                  >
                    <pre
                      class="text-xs font-mono leading-5 whitespace-pre-wrap break-all"
                      v-html="step.logHtml"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- 无 Steps 解析结果时显示全部日志 -->
            <div
              v-else
              class="space-y-2"
            >
              <div
                v-if="activeJobLogHtml"
                class="flex justify-end"
              >
                <UButton
                  :icon="copiedId === 'all' ? 'i-lucide-check' : 'i-lucide-copy'"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  :label="copiedId === 'all' ? '已复制' : '复制日志'"
                  @click="copyLogs(getActiveJobRawLogs(), 'all')"
                />
              </div>
              <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-900 text-gray-200 px-4 py-3 overflow-x-auto">
                <pre
                  v-if="activeJobLogHtml"
                  class="text-xs font-mono leading-5 whitespace-pre-wrap break-all"
                  v-html="activeJobLogHtml"
                />
                <pre
                  v-else
                  class="text-xs font-mono leading-5 text-gray-500"
                >暂无日志</pre>
              </div>
            </div>
          </template>

          <!-- 无 Jobs -->
          <div
            v-else-if="jobs.length === 0"
            class="text-center py-12 text-gray-400"
          >
            <UIcon
              name="i-lucide-box"
              class="w-12 h-12 mx-auto mb-3"
            />
            <p>暂无 Jobs</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
:deep(pre) a {
  color: #93c5fd;
  text-decoration: underline;
}
</style>
