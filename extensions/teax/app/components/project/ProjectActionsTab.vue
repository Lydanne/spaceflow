<script setup lang="ts">
import cronstrue from "cronstrue/i18n";

const props = defineProps<{
  owner: string;
  repo: string;
}>();

const toast = useToast();

interface WorkflowRunItem {
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
  actor: { login: string; avatar_url: string } | null;
}

interface WorkflowInput {
  description?: string;
  required?: boolean;
  default?: string;
  type?: string;
  options?: string[];
}

interface WorkflowItem {
  id: string;
  name: string;
  path: string;
  state: string;
  description: string;
  triggers: string[];
  schedules: string[];
  inputs: Record<string, WorkflowInput>;
}

interface BranchItem {
  name: string;
  commit: { id: string; message: string };
}

// Gitea Actions workflow runs
const actionsPage = ref(1);
const {
  data: actionsData,
  error: actionsError,
  status: actionsStatus,
  refresh: refreshActions,
} = useLazyFetch<{
  data: WorkflowRunItem[];
  total: number;
}>(`/api/repos/${props.owner}/${props.repo}/actions`, {
  query: { page: actionsPage, limit: 20 },
});
const workflowRuns = computed(() => actionsData.value?.data ?? []);

// Workflow 列表
const { data: workflowsData, error: workflowsError, status: workflowsStatus } = useLazyFetch<{
  data: WorkflowItem[];
}>(`/api/repos/${props.owner}/${props.repo}/workflows`);
const workflows = computed(() => workflowsData.value?.data ?? []);

// 分支列表
const { data: branchesData, error: branchesError, status: branchesStatus } = useLazyFetch<{
  data: BranchItem[];
  default_branch: string | null;
}>(`/api/repos/${props.owner}/${props.repo}/branches`);
const branches = computed(() => branchesData.value?.data ?? []);
const defaultBranch = computed(
  () => branchesData.value?.default_branch || "main",
);

// 加载状态
const isLoading = computed(() =>
  actionsStatus.value === "pending" || workflowsStatus.value === "pending" || branchesStatus.value === "pending",
);

// 错误处理
const fetchError = computed(() => {
  return actionsError.value || workflowsError.value || branchesError.value;
});
const isTokenExpired = computed(() => {
  const err = fetchError.value;
  if (!err) return false;
  return (err as { statusCode?: number }).statusCode === 401;
});
const errorMessage = computed(() => {
  if (!fetchError.value) return "";
  if (isTokenExpired.value) return "Gitea 访问令牌已过期，请重新登录";
  const msg = (fetchError.value as { data?: { message?: string } })?.data
    ?.message;
  return msg || "加载数据失败，请稍后重试";
});

// 侧边栏选中的 workflow（空 = 全部）
const activeWorkflowPath = ref("");

// run.path 格式: "publish.yaml@refs/heads/develop"
// workflow.path 格式: ".github/workflows/publish.yaml"
// 提取文件名进行匹配
function runMatchesWorkflow(runPath: string, workflowPath: string): boolean {
  const runFile = runPath.split("@")[0];
  const wfFile = workflowPath.replace(/^.*\//, "");
  return runFile === wfFile;
}

// 按侧边栏选中过滤 runs
const filteredRuns = computed(() => {
  if (!activeWorkflowPath.value) return workflowRuns.value;
  return workflowRuns.value.filter((r) =>
    runMatchesWorkflow(r.path, activeWorkflowPath.value),
  );
});

// 当前选中 workflow 对象
const activeWorkflow = computed(() => {
  if (!activeWorkflowPath.value) return null;
  return (
    workflows.value.find((w) => w.path === activeWorkflowPath.value) ?? null
  );
});
const showWorkflowDesc = ref(false);
watch(activeWorkflowPath, () => {
  showWorkflowDesc.value = false;
});

// 当前选中 workflow 的名称
const activeWorkflowName = computed(() => {
  if (!activeWorkflowPath.value) return "全部 Workflows";
  return activeWorkflow.value?.name ?? workflowName(activeWorkflowPath.value);
});

// 每个 workflow 的最近运行状态统计
function workflowRunCount(path: string): number {
  return workflowRuns.value.filter((r) => runMatchesWorkflow(r.path, path))
    .length;
}

// 下拉选项
const workflowOptions = computed(() =>
  workflows.value.map((w) => ({
    label: w.name,
    value: w.path,
  })),
);
const branchOptions = computed(() =>
  branches.value.map((b) => ({ label: b.name, value: b.name })),
);

// 触发 workflow
const showDispatchModal = ref(false);
const selectedWorkflow = ref("");
const selectedBranch = ref("");
const dispatching = ref(false);
const inputValues = reactive<Record<string, string>>({});

// 当前选中 workflow 的信息（用于 dispatch modal）
const selectedWorkflowItem = computed(
  () => workflows.value.find((w) => w.path === selectedWorkflow.value) ?? null,
);
const currentInputs = computed(() => selectedWorkflowItem.value?.inputs ?? {});
const currentDescription = computed(
  () => selectedWorkflowItem.value?.description ?? "",
);

function clearInputValues() {
  Object.keys(inputValues).forEach((key) => {
    Reflect.deleteProperty(inputValues, key);
  });
}

// 选中 workflow 变化时重置 inputValues
watch(selectedWorkflow, () => {
  clearInputValues();
  for (const [key, def] of Object.entries(currentInputs.value)) {
    inputValues[key] = def.default ?? "";
  }
});

watch(
  defaultBranch,
  (val) => {
    if (!selectedBranch.value) selectedBranch.value = val;
  },
  { immediate: true },
);

function openDispatchModal() {
  // 如果侧边栏已选中某个 workflow，默认选它
  selectedWorkflow.value = activeWorkflowPath.value || "";
  if (!selectedBranch.value) selectedBranch.value = defaultBranch.value;
  clearInputValues();
  // 手动触发 inputs 填充
  if (selectedWorkflow.value) {
    for (const [key, def] of Object.entries(currentInputs.value)) {
      inputValues[key] = def.default ?? "";
    }
  }
  showDispatchModal.value = true;
}

async function dispatchWorkflow() {
  if (!selectedWorkflow.value || !selectedBranch.value) return;
  dispatching.value = true;
  try {
    await $fetch(
      `/api/repos/${props.owner}/${props.repo}/actions`,
      {
        method: "POST",
        body: {
          workflow_id: selectedWorkflow.value,
          ref: selectedBranch.value,
          inputs: { ...inputValues },
        },
      },
    );
    toast.add({ title: "Workflow 已触发", color: "success" });
    showDispatchModal.value = false;
    setTimeout(() => refreshActions(), 2000);
  } catch (err: unknown) {
    const msg =
      (err as { data?: { message?: string } })?.data?.message || "触发失败";
    toast.add({ title: msg, color: "error" });
  } finally {
    dispatching.value = false;
  }
}

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
  if (status === "running" || status === "in_progress")
    return "i-lucide-loader";
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

function cronToReadable(cron: string): string {
  try {
    return cronstrue.toString(cron, {
      locale: "zh_CN",
      use24HourTimeFormat: true,
    });
  } catch {
    return cron;
  }
}

function workflowName(path: string): string {
  // Gitea path 格式: "filename.yml@refs/heads/branch"
  const atIdx = path.indexOf("@");
  const file = atIdx > 0 ? path.substring(0, atIdx) : path;
  return file.replace(/\.(yml|yaml)$/, "");
}

function workflowFileName(path: string): string {
  const atIdx = path.indexOf("@");
  return atIdx > 0 ? path.substring(0, atIdx) : path;
}
</script>

<template>
  <div>
    <!-- 加载中 -->
    <ProjectActionsSkeleton v-if="isLoading" />

    <!-- 错误提示 -->
    <div
      v-else-if="fetchError"
      class="mb-4 rounded-lg border px-4 py-3 flex items-center gap-3"
      :class="
        isTokenExpired
          ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800'
          : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
      "
    >
      <UIcon
        :name="isTokenExpired ? 'i-lucide-key-round' : 'i-lucide-alert-circle'"
        class="w-5 h-5 shrink-0"
        :class="
          isTokenExpired
            ? 'text-yellow-600 dark:text-yellow-400'
            : 'text-red-600 dark:text-red-400'
        "
      />
      <span
        class="text-sm flex-1"
        :class="
          isTokenExpired
            ? 'text-yellow-800 dark:text-yellow-200'
            : 'text-red-800 dark:text-red-200'
        "
      >
        {{ errorMessage }}
      </span>
      <UButton
        v-if="isTokenExpired"
        size="xs"
        color="warning"
        variant="soft"
        to="/api/auth/gitea"
        external
      >
        重新登录
      </UButton>
      <UButton
        v-else
        size="xs"
        color="error"
        variant="soft"
        @click="refreshActions()"
      >
        重试
      </UButton>
    </div>

    <div
      v-if="!isLoading && !fetchError"
      style="display: flex; gap: 1.5rem"
    >
      <!-- 左侧：Workflow 侧边栏 -->
      <div style="width: 14rem; flex-shrink: 0">
        <div class="flex items-center justify-between mb-3">
          <h3
            class="text-xs font-semibold text-gray-400 uppercase tracking-wider"
          >
            Workflows
          </h3>
        </div>
        <nav class="space-y-1">
          <!-- 全部 -->
          <button
            class="w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors"
            :class="
              !activeWorkflowPath
                ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300 font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            "
            @click="activeWorkflowPath = ''"
          >
            <span class="flex items-center gap-2">
              <UIcon
                name="i-lucide-list"
                class="w-4 h-4"
              />
              全部
            </span>
            <span class="text-xs text-gray-400">
              {{ workflowRuns.length }}
            </span>
          </button>

          <!-- 每个 workflow -->
          <button
            v-for="wf in workflows"
            :key="wf.path"
            class="w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors"
            :class="
              activeWorkflowPath === wf.path
                ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300 font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            "
            @click="activeWorkflowPath = wf.path"
          >
            <span class="flex items-center gap-2 truncate">
              <UIcon
                name="i-lucide-workflow"
                class="w-4 h-4 shrink-0"
              />
              <span class="truncate">{{ wf.name }}</span>
            </span>
            <span class="text-xs text-gray-400 shrink-0 ml-2">
              {{ workflowRunCount(wf.path) }}
            </span>
          </button>
        </nav>
      </div>

      <!-- 右侧：Runs 列表 -->
      <div class="flex-1 min-w-0">
        <!-- 头部 -->
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-medium text-gray-500 dark:text-gray-400">
            {{ activeWorkflowName }}
          </h2>
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="refreshActions()"
            >
              刷新
            </UButton>
            <UButton
              v-if="workflows.length > 0"
              icon="i-lucide-play"
              color="primary"
              size="sm"
              @click="openDispatchModal"
            >
              触发 Workflow
            </UButton>
          </div>
        </div>

        <!-- Workflow 信息卡片 -->
        <div
          v-if="activeWorkflow"
          class="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3"
        >
          <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <!-- 触发方式 -->
            <div class="flex items-center gap-1.5">
              <UIcon
                name="i-lucide-zap"
                class="w-4 h-4 text-gray-400 shrink-0"
              />
              <span
                v-if="activeWorkflow.triggers.length === 0"
                class="text-gray-400"
              >
                无触发方式
              </span>
              <span
                v-for="trigger in activeWorkflow.triggers"
                :key="trigger"
                class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
              >
                {{ trigger }}
              </span>
            </div>
            <!-- Inputs 数量 -->
            <div
              v-if="Object.keys(activeWorkflow.inputs).length > 0"
              class="flex items-center gap-1.5 text-gray-500 dark:text-gray-400"
            >
              <UIcon
                name="i-lucide-settings-2"
                class="w-4 h-4 shrink-0"
              />
              <span>{{ Object.keys(activeWorkflow.inputs).length }} 个参数</span>
            </div>
            <!-- 定时调度 -->
            <div
              v-if="activeWorkflow.schedules.length > 0"
              class="flex items-center gap-1.5 text-gray-500 dark:text-gray-400"
            >
              <UIcon
                name="i-lucide-calendar-clock"
                class="w-4 h-4 shrink-0"
              />
              <span
                v-for="(cron, idx) in activeWorkflow.schedules"
                :key="idx"
                class="text-xs"
                :title="cron"
              >
                {{ cronToReadable(cron) }}
              </span>
            </div>
            <!-- 文件路径 -->
            <div class="flex items-center gap-1.5 text-gray-400">
              <UIcon
                name="i-lucide-file-code"
                class="w-4 h-4 shrink-0"
              />
              <span class="font-mono text-xs">{{ activeWorkflow.path }}</span>
            </div>
            <!-- 折叠按钮 -->
            <button
              v-if="activeWorkflow.description"
              class="flex items-center gap-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              @click.prevent="showWorkflowDesc = !showWorkflowDesc"
            >
              <UIcon
                :name="
                  showWorkflowDesc
                    ? 'i-lucide-chevron-up'
                    : 'i-lucide-chevron-down'
                "
                class="w-4 h-4"
              />
              <span class="text-xs">{{
                showWorkflowDesc ? "收起" : "详情"
              }}</span>
            </button>
          </div>
          <!-- 描述（可折叠） -->
          <p
            v-if="activeWorkflow.description && showWorkflowDesc"
            class="text-sm text-gray-600 dark:text-gray-300 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700"
          >
            {{ activeWorkflow.description }}
          </p>
        </div>

        <!-- Runs 列表 -->
        <div
          v-if="filteredRuns.length > 0"
          class="space-y-3"
        >
          <NuxtLink
            v-for="run in filteredRuns"
            :key="run.id"
            :to="`/${props.owner}/${props.repo}/actions/runs/${run.id}`"
            class="block"
          >
            <UCard class="hover:ring-1 hover:ring-primary-500 transition-all">
              <div class="flex items-start gap-3">
                <!-- 状态图标 -->
                <UIcon
                  :name="runStatusIcon(run.status, run.conclusion)"
                  class="w-5 h-5 mt-0.5 shrink-0"
                  :class="{
                    'text-blue-500':
                      runStatusColor(run.status, run.conclusion) === 'info',
                    'text-amber-500 animate-spin':
                      runStatusColor(run.status, run.conclusion) === 'warning',
                    'text-green-500':
                      runStatusColor(run.status, run.conclusion) === 'success',
                    'text-red-500':
                      runStatusColor(run.status, run.conclusion) === 'error',
                    'text-gray-400':
                      runStatusColor(run.status, run.conclusion) === 'neutral',
                  }"
                />
                <!-- 内容 -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-sm truncate">
                      {{ run.displayTitle }}
                    </span>
                    <span class="text-xs text-gray-400 shrink-0">
                      #{{ run.runNumber }}
                    </span>
                    <UBadge
                      :color="runStatusColor(run.status, run.conclusion) as any"
                      variant="subtle"
                      size="xs"
                    >
                      {{ runStatusLabel(run.status, run.conclusion) }}
                    </UBadge>
                  </div>
                  <div
                    class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-400"
                  >
                    <span
                      v-if="!activeWorkflowPath"
                      class="flex items-center gap-1"
                    >
                      <UIcon
                        name="i-lucide-workflow"
                        class="w-3.5 h-3.5"
                      />
                      {{ workflowFileName(run.path) }}
                    </span>
                    <span class="flex items-center gap-1">
                      <UIcon
                        name="i-lucide-git-branch"
                        class="w-3.5 h-3.5"
                      />
                      {{ run.headBranch }}
                    </span>
                    <span class="font-mono">{{
                      run.headSha?.substring(0, 7)
                    }}</span>
                    <UBadge
                      color="neutral"
                      variant="subtle"
                      size="xs"
                    >
                      {{ eventLabel(run.event) }}
                    </UBadge>
                    <span
                      v-if="run.actor"
                      class="flex items-center gap-1"
                    >
                      <UIcon
                        name="i-lucide-user"
                        class="w-3.5 h-3.5"
                      />
                      {{ run.actor.login }}
                    </span>
                    <span
                      v-if="relativeTime(run.startedAt)"
                      class="flex items-center gap-1"
                    >
                      <UIcon
                        name="i-lucide-clock"
                        class="w-3.5 h-3.5"
                      />
                      {{ relativeTime(run.startedAt) }}
                    </span>
                    <span
                      v-if="formatDuration(run.startedAt, run.completedAt)"
                      class="flex items-center gap-1"
                    >
                      <UIcon
                        name="i-lucide-timer"
                        class="w-3.5 h-3.5"
                      />
                      {{ formatDuration(run.startedAt, run.completedAt) }}
                    </span>
                  </div>
                </div>
                <!-- 箭头图标 -->
                <UIcon
                  name="i-lucide-chevron-right"
                  class="w-4 h-4 text-gray-400 shrink-0 mt-0.5"
                />
              </div>
            </UCard>
          </NuxtLink>
        </div>

        <!-- 空状态 -->
        <div
          v-else
          class="text-center py-12 text-gray-400"
        >
          <UIcon
            name="i-lucide-rocket"
            class="w-12 h-12 mx-auto mb-3"
          />
          <template v-if="activeWorkflowPath">
            <p>{{ activeWorkflowName }} 暂无运行记录</p>
            <p class="text-sm mt-1">
              点击「触发 Workflow」手动运行
            </p>
          </template>
          <template v-else>
            <p>暂无 Actions 运行记录</p>
            <p class="text-sm mt-1">
              在仓库中添加 .gitea/workflows/ 或 .github/workflows/ 来配置 CI/CD
            </p>
          </template>
        </div>
      </div>

      <!-- 触发 Workflow Modal -->
      <UModal v-model:open="showDispatchModal">
        <template #content>
          <div class="p-6 space-y-4">
            <h3 class="text-lg font-semibold">
              触发 Workflow
            </h3>

            <div>
              <label class="block text-sm font-medium mb-1">Workflow</label>
              <USelect
                v-model="selectedWorkflow"
                :items="workflowOptions"
                value-key="value"
                class="w-full"
                placeholder="选择 Workflow"
              />
            </div>

            <p
              v-if="currentDescription"
              class="text-sm text-gray-500 dark:text-gray-400 -mt-2"
            >
              {{ currentDescription }}
            </p>

            <div>
              <label class="block text-sm font-medium mb-1">分支</label>
              <USelect
                v-model="selectedBranch"
                :items="branchOptions"
                value-key="value"
                class="w-full"
                placeholder="选择分支"
              />
            </div>

            <!-- workflow_dispatch inputs -->
            <template v-if="Object.keys(currentInputs).length > 0">
              <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
                <p
                  class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3"
                >
                  Workflow Inputs
                </p>
                <div class="space-y-3">
                  <div
                    v-for="(def, key) in currentInputs"
                    :key="key"
                  >
                    <label class="block text-sm font-medium mb-1">
                      {{ key }}
                      <span
                        v-if="def.required"
                        class="text-red-500"
                      >*</span>
                    </label>
                    <p
                      v-if="def.description"
                      class="text-xs text-gray-400 mb-1"
                    >
                      {{ def.description }}
                    </p>

                    <USelect
                      v-if="def.type === 'choice' && def.options"
                      :model-value="inputValues[key]"
                      :items="def.options.map((o) => ({ label: o, value: o }))"
                      value-key="value"
                      class="w-full"
                      @update:model-value="inputValues[key] = $event"
                    />
                    <USwitch
                      v-else-if="def.type === 'boolean'"
                      :model-value="inputValues[key] === 'true'"
                      @update:model-value="
                        inputValues[key] = $event ? 'true' : 'false'
                      "
                    />
                    <UInput
                      v-else
                      :model-value="inputValues[key]"
                      :placeholder="def.default || ''"
                      class="w-full"
                      @update:model-value="inputValues[key] = $event"
                    />
                  </div>
                </div>
              </div>
            </template>

            <div class="flex justify-end gap-2 pt-2">
              <UButton
                color="neutral"
                variant="ghost"
                @click="showDispatchModal = false"
              >
                取消
              </UButton>
              <UButton
                icon="i-lucide-play"
                color="primary"
                :loading="dispatching"
                :disabled="!selectedWorkflow || !selectedBranch"
                @click="dispatchWorkflow"
              >
                触发
              </UButton>
            </div>
          </div>
        </template>
      </UModal>
    </div>
  </div>
</template>
