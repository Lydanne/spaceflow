<script setup lang="ts">
const props = defineProps<{
  orgId: string;
  projectId: string;
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
  actor: { login: string; avatarUrl: string } | null;
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
  refresh: refreshActions,
} = await useFetch<{
  data: WorkflowRunItem[];
  total: number;
}>(`/api/orgs/${props.orgId}/projects/${props.projectId}/actions`, {
  query: { page: actionsPage, limit: 20 },
});
const workflowRuns = computed(() => actionsData.value?.data ?? []);

// Workflow 列表
const { data: workflowsData, error: workflowsError } = await useFetch<{
  data: WorkflowItem[];
}>(`/api/orgs/${props.orgId}/projects/${props.projectId}/workflows`);
const workflows = computed(() => workflowsData.value?.data ?? []);

// 分支列表
const { data: branchesData, error: branchesError } = await useFetch<{
  data: BranchItem[];
  defaultBranch: string | null;
}>(`/api/orgs/${props.orgId}/projects/${props.projectId}/branches`);
const branches = computed(() => branchesData.value?.data ?? []);
const defaultBranch = computed(
  () => branchesData.value?.defaultBranch || "main",
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
  return workflowRuns.value.filter(r =>
    runMatchesWorkflow(r.path, activeWorkflowPath.value),
  );
});

// 当前选中 workflow 的名称
const activeWorkflowName = computed(() => {
  if (!activeWorkflowPath.value) return "全部 Workflows";
  const wf = workflows.value.find(w => w.path === activeWorkflowPath.value);
  return wf?.name ?? workflowName(activeWorkflowPath.value);
});

// 每个 workflow 的最近运行状态统计
function workflowRunCount(path: string): number {
  return workflowRuns.value.filter(r => runMatchesWorkflow(r.path, path))
    .length;
}

// 下拉选项
const workflowOptions = computed(() =>
  workflows.value.map(w => ({ label: w.name, value: w.path })),
);
const branchOptions = computed(() =>
  branches.value.map(b => ({ label: b.name, value: b.name })),
);

// 触发 workflow
const showDispatchModal = ref(false);
const selectedWorkflow = ref("");
const selectedBranch = ref("");
const dispatching = ref(false);
const inputValues = reactive<Record<string, string>>({});

// 当前选中 workflow 的 inputs 定义（用于 dispatch modal）
const currentInputs = computed(() => {
  const wf = workflows.value.find(w => w.path === selectedWorkflow.value);
  return wf?.inputs ?? {};
});

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
      `/api/orgs/${props.orgId}/projects/${props.projectId}/actions`,
      {
        method: "POST",
        body: {
          workflowId: selectedWorkflow.value,
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
  if (status === "running" || status === "waiting") return "warning";
  if (conclusion === "success") return "success";
  if (conclusion === "failure") return "error";
  if (conclusion === "cancelled") return "neutral";
  return "info";
}

function runStatusLabel(status: string, conclusion: string): string {
  if (status === "running") return "运行中";
  if (status === "waiting") return "等待中";
  if (conclusion === "success") return "成功";
  if (conclusion === "failure") return "失败";
  if (conclusion === "cancelled") return "已取消";
  if (conclusion === "skipped") return "已跳过";
  return status || "未知";
}

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return "-";
  const seconds = Math.round(
    (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000,
  );
  if (seconds < 0) return "-";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function workflowName(path: string): string {
  return path.replace(/^.*\//, "").replace(/\.(yml|yaml)$/, "");
}
</script>

<template>
  <div>
    <!-- 错误提示 -->
    <div
      v-if="fetchError"
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

    <div style="display: flex; gap: 1.5rem">
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

        <!-- Runs 列表 -->
        <div
          v-if="filteredRuns.length > 0"
          class="space-y-3"
        >
          <a
            v-for="run in filteredRuns"
            :key="run.id"
            :href="run.htmlUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="block"
          >
            <UCard class="hover:ring-1 hover:ring-primary-500 transition-all">
              <div class="flex items-center justify-between">
                <div>
                  <div class="flex items-center gap-2">
                    <UBadge
                      :color="runStatusColor(run.status, run.conclusion) as any"
                      variant="subtle"
                      size="sm"
                    >
                      {{ runStatusLabel(run.status, run.conclusion) }}
                    </UBadge>
                    <span class="font-medium text-sm">
                      {{ run.displayTitle }}
                    </span>
                    <span class="text-xs text-gray-400">
                      #{{ run.runNumber }}
                    </span>
                  </div>
                  <div
                    class="flex items-center gap-3 mt-1.5 text-xs text-gray-400"
                  >
                    <span v-if="!activeWorkflowPath">
                      {{ workflowName(run.path) }}
                    </span>
                    <span>{{ run.headBranch }}</span>
                    <span>{{ run.headSha?.substring(0, 7) }}</span>
                    <span>{{ run.event }}</span>
                    <span v-if="run.actor">{{ run.actor.login }}</span>
                    <span
                      v-if="
                        run.startedAt
                          && new Date(run.startedAt).getFullYear() > 1970
                      "
                    >
                      {{ new Date(run.startedAt).toLocaleString("zh-CN") }}
                    </span>
                    <span>{{
                      formatDuration(run.startedAt, run.completedAt)
                    }}</span>
                  </div>
                </div>
                <UIcon
                  name="i-lucide-external-link"
                  class="w-4 h-4 text-gray-400 shrink-0"
                />
              </div>
            </UCard>
          </a>
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
