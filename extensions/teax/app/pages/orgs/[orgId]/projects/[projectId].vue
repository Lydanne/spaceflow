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
      <div v-if="activeTab === 'settings'">
        <UCard>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">项目名称</label>
              <p class="text-gray-600 dark:text-gray-400">
                {{ project.fullName }}
              </p>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Clone URL</label>
              <p class="text-gray-600 dark:text-gray-400 text-sm font-mono">
                {{ project.cloneUrl }}
              </p>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">默认分支</label>
              <p class="text-gray-600 dark:text-gray-400">
                {{ project.defaultBranch }}
              </p>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Webhook</label>
              <p class="text-gray-600 dark:text-gray-400">
                {{
                  project.webhookId
                    ? `已配置 (ID: ${project.webhookId})`
                    : "未配置"
                }}
              </p>
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </div>
</template>
