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

interface WorkflowItem {
  id: number;
  name: string;
  path: string;
  state: string;
}

interface BranchItem {
  name: string;
  commit: { id: string; message: string };
}

// Gitea Actions workflow runs
const actionsPage = ref(1);
const { data: actionsData, refresh: refreshActions } = await useFetch<{
  data: WorkflowRunItem[];
  total: number;
}>(`/api/orgs/${props.orgId}/projects/${props.projectId}/actions`, {
  query: { page: actionsPage, limit: 20 },
});
const workflowRuns = computed(() => actionsData.value?.data ?? []);

// Workflow 列表（用于触发）
const { data: workflowsData } = await useFetch<{ data: WorkflowItem[] }>(
  `/api/orgs/${props.orgId}/projects/${props.projectId}/workflows`,
);
const workflows = computed(() => workflowsData.value?.data ?? []);

// 分支列表
const { data: branchesData } = await useFetch<{
  data: BranchItem[];
  defaultBranch: string | null;
}>(`/api/orgs/${props.orgId}/projects/${props.projectId}/branches`);
const branches = computed(() => branchesData.value?.data ?? []);
const defaultBranch = computed(
  () => branchesData.value?.defaultBranch || "main",
);

// 触发 workflow
const showDispatchModal = ref(false);
const selectedWorkflow = ref("");
const selectedBranch = ref("");
const dispatching = ref(false);

watch(
  defaultBranch,
  (val) => {
    if (!selectedBranch.value) selectedBranch.value = val;
  },
  { immediate: true },
);

async function dispatchWorkflow() {
  if (!selectedWorkflow.value || !selectedBranch.value) return;
  dispatching.value = true;
  try {
    await $fetch(`/api/orgs/${props.orgId}/projects/${props.projectId}/actions`, {
      method: "POST",
      body: {
        workflowId: selectedWorkflow.value,
        ref: selectedBranch.value,
      },
    });
    toast.add({ title: "Workflow 已触发", color: "success" });
    showDispatchModal.value = false;
    // 延迟刷新让 Gitea 有时间创建 run
    setTimeout(() => refreshActions(), 2000);
  } catch (err: unknown) {
    const msg
      = (err as { data?: { message?: string } })?.data?.message || "触发失败";
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
  // .gitea/workflows/deploy.yml or .github/workflows/deploy.yml -> deploy
  return path.replace(/^.*\//, "").replace(/\.(yml|yaml)$/, "");
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-sm font-medium text-gray-500 dark:text-gray-400">
        Gitea Actions Workflow Runs
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
          @click="showDispatchModal = true"
        >
          触发 Workflow
        </UButton>
      </div>
    </div>

    <div
      v-if="workflowRuns.length > 0"
      class="space-y-3"
    >
      <a
        v-for="run in workflowRuns"
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
                <span>
                  {{ workflowName(run.path) }}
                </span>
                <span>
                  {{ run.headBranch }}
                </span>
                <span>
                  {{ run.headSha?.substring(0, 7) }}
                </span>
                <span>
                  {{ run.event }}
                </span>
                <span v-if="run.actor">
                  {{ run.actor.login }}
                </span>
                <span
                  v-if="
                    run.startedAt
                      && new Date(run.startedAt).getFullYear() > 1970
                  "
                >
                  {{ new Date(run.startedAt).toLocaleString("zh-CN") }}
                </span>
                <span>
                  {{ formatDuration(run.startedAt, run.completedAt) }}
                </span>
              </div>
            </div>
            <UIcon
              name="i-lucide-external-link"
              class="w-4 h-4 text-gray-400"
            />
          </div>
        </UCard>
      </a>
    </div>

    <div
      v-else
      class="text-center py-12 text-gray-400"
    >
      <UIcon
        name="i-lucide-rocket"
        class="w-12 h-12 mx-auto mb-3"
      />
      <p>暂无 Actions 运行记录</p>
      <p class="text-sm mt-1">
        在仓库中添加 .gitea/workflows/ 或 .github/workflows/ 来配置 CI/CD
      </p>
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
            <USelectMenu
              v-model="selectedWorkflow"
              :items="workflows.map((w) => ({ label: w.name, value: w.path }))"
              value-key="value"
              class="w-full"
              placeholder="选择 Workflow"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-1">分支</label>
            <USelectMenu
              v-model="selectedBranch"
              :items="branches.map((b) => b.name)"
              class="w-full"
              placeholder="选择分支"
            />
          </div>

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
</template>
