<script setup lang="ts">
const route = useRoute();
const orgId = route.params.orgId as string;
const projectId = route.params.projectId as string;

interface ProjectDetail {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  defaultBranch: string | null;
  cloneUrl: string;
  webhookId: number | null;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

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

const toast = useToast();

const { data: project, status: projectStatus } = await useFetch<ProjectDetail>(
  `/api/orgs/${orgId}/projects/${projectId}`,
);

const activeTab = ref("actions");

const tabs = [
  { label: "Actions", value: "actions", icon: "i-lucide-rocket" },
  { label: "Agents", value: "agents", icon: "i-lucide-bot" },
  { label: "Pages", value: "pages", icon: "i-lucide-globe" },
  { label: "设置", value: "settings", icon: "i-lucide-settings" },
];

// Gitea Actions workflow runs
const actionsPage = ref(1);
const { data: actionsData, refresh: refreshActions } = await useFetch<{
  data: WorkflowRunItem[];
  total: number;
}>(`/api/orgs/${orgId}/projects/${projectId}/actions`, {
  query: { page: actionsPage, limit: 20 },
});
const workflowRuns = computed(() => actionsData.value?.data ?? []);

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

// Workflow 列表（用于触发）
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

const { data: workflowsData } = await useFetch<{ data: WorkflowItem[] }>(
  `/api/orgs/${orgId}/projects/${projectId}/workflows`,
);
const workflows = computed(() => workflowsData.value?.data ?? []);

const { data: branchesData } = await useFetch<{
  data: BranchItem[];
  defaultBranch: string | null;
}>(`/api/orgs/${orgId}/projects/${projectId}/branches`);
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
    await $fetch(`/api/orgs/${orgId}/projects/${projectId}/actions`, {
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

// 项目设置
interface ProjectSettings {
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
}

const settingsForm = reactive<ProjectSettings>({
  notifyOnSuccess: true,
  notifyOnFailure: true,
});
const savingSettings = ref(false);

watch(
  () => project.value?.settings,
  (s) => {
    if (!s) return;
    const ps = s as unknown as ProjectSettings;
    settingsForm.notifyOnSuccess = ps.notifyOnSuccess ?? true;
    settingsForm.notifyOnFailure = ps.notifyOnFailure ?? true;
  },
  { immediate: true },
);

async function saveSettings() {
  savingSettings.value = true;
  try {
    await $fetch(`/api/orgs/${orgId}/projects/${projectId}/settings`, {
      method: "PATCH",
      body: { ...settingsForm },
    });
    toast.add({ title: "设置已保存", color: "success" });
  } catch {
    toast.add({ title: "保存失败", color: "error" });
  } finally {
    savingSettings.value = false;
  }
}

// 删除项目
const deleting = ref(false);
const confirmDeleteName = ref("");

async function deleteProject() {
  if (confirmDeleteName.value !== project.value?.fullName) return;
  deleting.value = true;
  try {
    await $fetch(`/api/orgs/${orgId}/projects/${projectId}`, {
      method: "DELETE",
    });
    toast.add({ title: "项目已删除", color: "success" });
    navigateTo(`/orgs/${orgId}/projects`);
  } catch {
    toast.add({ title: "删除失败", color: "error" });
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-8">
    <!-- 加载中 -->
    <div
      v-if="projectStatus === 'pending'"
      class="flex justify-center py-12"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-6 h-6 animate-spin text-gray-400"
      />
    </div>

    <template v-else-if="project">
      <!-- 头部 -->
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            size="sm"
            :to="`/orgs/${orgId}/projects`"
          />
          <div>
            <h1 class="text-xl font-bold">
              {{ project.fullName }}
            </h1>
            <p
              v-if="project.description"
              class="text-sm text-gray-500 dark:text-gray-400 mt-0.5"
            >
              {{ project.description }}
            </p>
          </div>
        </div>

        <UBadge
          v-if="!project.webhookId"
          color="warning"
          variant="subtle"
        >
          Webhook 未配置
        </UBadge>
      </div>

      <!-- Tab 导航 -->
      <div class="border-b border-gray-200 dark:border-gray-800 mb-6">
        <nav class="flex gap-1 -mb-px">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5"
            :class="
              activeTab === tab.value
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            "
            @click="activeTab = tab.value"
          >
            <UIcon
              :name="tab.icon"
              class="w-4 h-4"
            />
            {{ tab.label }}
          </button>
        </nav>
      </div>

      <!-- Actions Tab -->
      <div v-if="activeTab === 'actions'">
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
      </div>

      <!-- Agents Tab -->
      <div v-if="activeTab === 'agents'">
        <div class="text-center py-12 text-gray-400">
          <UIcon
            name="i-lucide-bot"
            class="w-12 h-12 mx-auto mb-3"
          />
          <p>Agent 功能将在 Phase 3 实现</p>
        </div>
      </div>

      <!-- Pages Tab -->
      <div v-if="activeTab === 'pages'">
        <div class="text-center py-12 text-gray-400">
          <UIcon
            name="i-lucide-globe"
            class="w-12 h-12 mx-auto mb-3"
          />
          <p>Pages 功能将在 Phase 3 实现</p>
        </div>
      </div>

      <!-- Settings Tab -->
      <div
        v-if="activeTab === 'settings'"
        class="space-y-6"
      >
        <!-- 基本信息 -->
        <UCard>
          <template #header>
            <h3 class="font-semibold">
              基本信息
            </h3>
          </template>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p class="text-gray-500 dark:text-gray-400">
                项目名称
              </p>
              <p class="font-medium mt-0.5">
                {{ project.fullName }}
              </p>
            </div>
            <div>
              <p class="text-gray-500 dark:text-gray-400">
                默认分支
              </p>
              <p class="font-medium mt-0.5">
                {{ project.defaultBranch }}
              </p>
            </div>
            <div>
              <p class="text-gray-500 dark:text-gray-400">
                Clone URL
              </p>
              <p class="font-medium font-mono text-xs mt-0.5 break-all">
                {{ project.cloneUrl }}
              </p>
            </div>
            <div>
              <p class="text-gray-500 dark:text-gray-400">
                Webhook
              </p>
              <p class="font-medium mt-0.5">
                {{
                  project.webhookId
                    ? `已配置 (ID: ${project.webhookId})`
                    : "未配置"
                }}
              </p>
            </div>
          </div>
        </UCard>

        <!-- 通知设置 -->
        <UCard>
          <template #header>
            <h3 class="font-semibold">
              通知设置
            </h3>
          </template>
          <div class="space-y-5">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-sm">
                  成功通知
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Actions 运行成功时发送飞书通知
                </p>
              </div>
              <USwitch v-model="settingsForm.notifyOnSuccess" />
            </div>

            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-sm">
                  失败通知
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Actions 运行失败时发送飞书通知
                </p>
              </div>
              <USwitch v-model="settingsForm.notifyOnFailure" />
            </div>

            <div class="flex justify-end pt-2">
              <UButton
                color="primary"
                :loading="savingSettings"
                @click="saveSettings"
              >
                保存设置
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- 危险操作 -->
        <UCard>
          <template #header>
            <h3 class="font-semibold text-red-600 dark:text-red-400">
              危险操作
            </h3>
          </template>
          <div class="space-y-4">
            <p class="text-sm text-gray-600 dark:text-gray-400">
              删除项目将同时移除所有发布记录和 Webhook 配置，此操作不可恢复。
            </p>
            <div>
              <p class="text-sm mb-2">
                请输入项目名称
                <strong>{{ project.fullName }}</strong> 以确认删除：
              </p>
              <div class="flex gap-2">
                <UInput
                  v-model="confirmDeleteName"
                  :placeholder="project.fullName"
                  size="sm"
                  class="flex-1"
                />
                <UButton
                  color="error"
                  variant="soft"
                  :loading="deleting"
                  :disabled="confirmDeleteName !== project.fullName"
                  @click="deleteProject"
                >
                  删除项目
                </UButton>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </template>

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
