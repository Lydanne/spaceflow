<script setup lang="ts">
import AnsiToHtml from "ansi-to-html";

export interface JobInfo {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  runnerName?: string | null;
}

const props = withDefaults(
  defineProps<{
    owner: string;
    repo: string;
    jobs: JobInfo[];
    /** 紧凑模式（嵌入式使用，只显示日志不显示 Steps 解析） */
    compact?: boolean;
    /** 最大高度 */
    maxHeight?: string;
  }>(),
  {
    compact: false,
    maxHeight: "auto",
  },
);

// 当前选中的 Job
const activeJobId = ref<number | null>(null);

// 自动选中第一个 Job
watch(
  () => props.jobs,
  (list) => {
    const first = list[0];
    if (first && !activeJobId.value) {
      activeJobId.value = first.id;
    }
  },
  { immediate: true },
);

const activeJob = computed(() => props.jobs.find((j) => j.id === activeJobId.value) ?? null);

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

function getActiveJobRawLogs(): string {
  if (!activeJobId.value) return "";
  return jobLogs.value[activeJobId.value] || "";
}

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

// 辅助函数
function runStatusColor(status: string, conclusion: string | null): string {
  if (status === "queued" || status === "waiting") return "info";
  if (status === "running" || status === "in_progress") return "warning";
  if (conclusion === "success") return "success";
  if (conclusion === "failure") return "error";
  if (conclusion === "cancelled") return "neutral";
  return "info";
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

function formatDuration(startedAt?: string | null, completedAt?: string | null): string {
  if (!startedAt || !completedAt) return "";
  const seconds = Math.round(
    (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000,
  );
  if (seconds < 0) return "";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

// 暴露给外部
defineExpose({
  selectJob: (jobId: number) => {
    activeJobId.value = jobId;
  },
});
</script>

<template>
  <!-- 紧凑模式：只显示 Job 选择器 + 日志 -->
  <div v-if="compact">
    <!-- Job 选择器 -->
    <div class="flex items-center gap-2 mb-2 overflow-x-auto pb-1">
      <button
        v-for="job in jobs"
        :key="job.id"
        class="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md whitespace-nowrap transition-colors"
        :class="activeJobId === job.id
          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'"
        @click="activeJobId = job.id"
      >
        <UIcon
          :name="runStatusIcon(job.status, job.conclusion)"
          class="w-3 h-3"
          :class="{
            'text-blue-500': runStatusColor(job.status, job.conclusion) === 'info',
            'text-amber-500 animate-spin': runStatusColor(job.status, job.conclusion) === 'warning',
            'text-green-500': runStatusColor(job.status, job.conclusion) === 'success',
            'text-red-500': runStatusColor(job.status, job.conclusion) === 'error',
            'text-gray-400': runStatusColor(job.status, job.conclusion) === 'neutral',
          }"
        />
        {{ job.name }}
      </button>
    </div>

    <!-- 日志内容 -->
    <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-900 overflow-hidden">
      <!-- 加载中 -->
      <div
        v-if="activeJobId && jobLogsLoading[activeJobId]"
        class="flex items-center gap-2 text-gray-400 text-sm px-4 py-6"
      >
        <UIcon
          name="i-lucide-loader-2"
          class="w-4 h-4 animate-spin"
        />
        加载日志中...
      </div>

      <!-- 日志内容 -->
      <div
        v-else-if="activeJobLogHtml"
        class="overflow-auto px-4 py-3"
        :style="{ maxHeight: maxHeight === 'auto' ? '320px' : maxHeight }"
      >
        <pre
          class="text-xs font-mono leading-5 whitespace-pre-wrap break-all text-gray-200"
          v-html="activeJobLogHtml"
        />
      </div>

      <!-- 无日志 -->
      <div
        v-else
        class="text-center text-sm text-gray-500 py-6"
      >
        暂无日志
      </div>
    </div>
  </div>

  <!-- 完整模式：左右分栏 -->
  <div
    v-else
    class="flex gap-4"
    :style="{ minHeight: '400px' }"
  >
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

<style scoped>
:deep(pre) a {
  color: #93c5fd;
  text-decoration: underline;
}
</style>
