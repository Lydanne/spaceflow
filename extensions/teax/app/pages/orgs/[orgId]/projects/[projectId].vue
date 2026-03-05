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

interface PublishTaskItem {
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
  createdAt: string;
  triggeredByUsername: string | null;
}

interface BranchItem {
  name: string;
  commit: { id: string; message: string };
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

// 发布任务列表
const publishPage = ref(1);
const { data: publishData, refresh: refreshPublish } = await useFetch<{
  data: PublishTaskItem[];
  total: number;
}>(`/api/orgs/${orgId}/projects/${projectId}/publish`, {
  query: { page: publishPage, limit: 20 },
});
const publishTasks = computed(() => publishData.value?.data ?? []);

// 分支列表
const { data: branchesData } = await useFetch<{
  data: BranchItem[];
  defaultBranch: string | null;
}>(`/api/orgs/${orgId}/projects/${projectId}/branches`);
const branches = computed(() => branchesData.value?.data ?? []);
const defaultBranch = computed(
  () => branchesData.value?.defaultBranch || "main",
);

// 手动发布
const selectedBranch = ref("");
const publishing = ref(false);

watch(
  defaultBranch,
  (val) => {
    if (!selectedBranch.value) selectedBranch.value = val;
  },
  { immediate: true },
);

async function triggerPublish() {
  publishing.value = true;
  try {
    await $fetch(`/api/orgs/${orgId}/projects/${projectId}/publish`, {
      method: "POST",
      body: { branch: selectedBranch.value || defaultBranch.value },
    });
    toast.add({ title: "发布任务已创建", color: "success" });
    await refreshPublish();
  } catch (err: unknown) {
    const msg
      = (err as { data?: { message?: string } })?.data?.message || "发布失败";
    toast.add({ title: msg, color: "error" });
  } finally {
    publishing.value = false;
  }
}

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

// 项目设置
interface ProjectSettings {
  autoDeploy: boolean;
  deployBranches: string[];
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  approvalRequired: boolean;
}

const settingsForm = reactive<ProjectSettings>({
  autoDeploy: false,
  deployBranches: [],
  notifyOnSuccess: true,
  notifyOnFailure: true,
  approvalRequired: false,
});
const savingSettings = ref(false);
const deployBranchInput = ref("");

watch(
  () => project.value?.settings,
  (s) => {
    if (!s) return;
    const ps = s as unknown as ProjectSettings;
    settingsForm.autoDeploy = ps.autoDeploy ?? false;
    settingsForm.deployBranches = ps.deployBranches ?? [];
    settingsForm.notifyOnSuccess = ps.notifyOnSuccess ?? true;
    settingsForm.notifyOnFailure = ps.notifyOnFailure ?? true;
    settingsForm.approvalRequired = ps.approvalRequired ?? false;
  },
  { immediate: true },
);

function addDeployBranch() {
  const b = deployBranchInput.value.trim();
  if (b && !settingsForm.deployBranches.includes(b)) {
    settingsForm.deployBranches.push(b);
  }
  deployBranchInput.value = "";
}

function removeDeployBranch(branch: string) {
  settingsForm.deployBranches = settingsForm.deployBranches.filter(
    b => b !== branch,
  );
}

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
        <!-- 发布控制 -->
        <UCard class="mb-6">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <label class="text-sm font-medium">分支:</label>
              <USelectMenu
                v-model="selectedBranch"
                :items="branches.map((b) => b.name)"
                class="w-48"
              />
            </div>
            <UButton
              icon="i-lucide-rocket"
              color="primary"
              :loading="publishing"
              @click="triggerPublish"
            >
              新建发布
            </UButton>
          </div>
        </UCard>

        <!-- 发布任务列表 -->
        <div
          v-if="publishTasks.length > 0"
          class="space-y-3"
        >
          <NuxtLink
            v-for="task in publishTasks"
            :key="task.id"
            :to="`/orgs/${orgId}/projects/${projectId}/publish/${task.id}`"
            class="block"
          >
            <UCard class="hover:ring-1 hover:ring-primary-500 transition-all">
              <div class="flex items-center justify-between">
                <div>
                  <div class="flex items-center gap-2">
                    <UBadge
                      :color="statusColor(task.status) as any"
                      variant="subtle"
                      size="sm"
                    >
                      {{ statusLabel(task.status) }}
                    </UBadge>
                    <span class="font-medium text-sm">
                      {{ task.commitSha?.substring(0, 7) }}
                    </span>
                  </div>
                  <p
                    v-if="task.commitMessage"
                    class="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate max-w-lg"
                  >
                    {{ task.commitMessage }}
                  </p>
                  <div
                    class="flex items-center gap-3 mt-1.5 text-xs text-gray-400"
                  >
                    <span>{{ task.branch }}</span>
                    <span>{{ task.triggerType }}</span>
                    <span v-if="task.triggeredByUsername">
                      {{ task.triggeredByUsername }}
                    </span>
                    <span>{{
                      new Date(task.createdAt).toLocaleString("zh-CN")
                    }}</span>
                    <span v-if="task.duration">
                      {{ formatDuration(task.duration) }}
                    </span>
                  </div>
                </div>
                <UIcon
                  name="i-lucide-chevron-right"
                  class="w-4 h-4 text-gray-400"
                />
              </div>
            </UCard>
          </NuxtLink>
        </div>

        <div
          v-else
          class="text-center py-12 text-gray-400"
        >
          <UIcon
            name="i-lucide-rocket"
            class="w-12 h-12 mx-auto mb-3"
          />
          <p>暂无发布任务</p>
          <p class="text-sm mt-1">
            点击「新建发布」触发构建部署
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

        <!-- 发布设置 -->
        <UCard>
          <template #header>
            <h3 class="font-semibold">
              发布设置
            </h3>
          </template>
          <div class="space-y-5">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-sm">
                  自动部署
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  代码推送到指定分支时自动触发发布
                </p>
              </div>
              <USwitch v-model="settingsForm.autoDeploy" />
            </div>

            <div v-if="settingsForm.autoDeploy">
              <p class="font-medium text-sm mb-2">
                部署分支
              </p>
              <div class="flex gap-2 mb-2">
                <UInput
                  v-model="deployBranchInput"
                  placeholder="输入分支名，回车添加"
                  size="sm"
                  class="flex-1"
                  @keydown.enter.prevent="addDeployBranch"
                />
                <UButton
                  size="sm"
                  color="neutral"
                  variant="soft"
                  @click="addDeployBranch"
                >
                  添加
                </UButton>
              </div>
              <div
                v-if="settingsForm.deployBranches.length > 0"
                class="flex flex-wrap gap-1.5"
              >
                <UBadge
                  v-for="b in settingsForm.deployBranches"
                  :key="b"
                  color="primary"
                  variant="subtle"
                  class="cursor-pointer"
                  @click="removeDeployBranch(b)"
                >
                  {{ b }}
                  <UIcon
                    name="i-lucide-x"
                    class="w-3 h-3 ml-1"
                  />
                </UBadge>
              </div>
              <p
                v-else
                class="text-xs text-gray-400"
              >
                未配置部署分支时，默认使用 {{ project.defaultBranch || "main" }}
              </p>
            </div>

            <USeparator />

            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-sm">
                  成功通知
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  发布成功时发送通知
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
                  发布失败时发送通知
                </p>
              </div>
              <USwitch v-model="settingsForm.notifyOnFailure" />
            </div>

            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-sm">
                  发布审批
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  发布前需要审批通过
                </p>
              </div>
              <USwitch v-model="settingsForm.approvalRequired" />
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
  </div>
</template>
