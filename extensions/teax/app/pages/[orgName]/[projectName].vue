<script setup lang="ts">
const route = useRoute();
const orgName = route.params.orgName as string;
const projectName = route.params.projectName as string;

interface ProjectDetail {
  id: string;
  organization_id: string;
  name: string;
  full_name: string;
  description: string | null;
  default_branch: string | null;
  clone_url: string;
  webhook_id: number | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const { data: project, status: projectStatus } = await useFetch<ProjectDetail>(
  `/api/resolve/${orgName}/${projectName}`,
);

const orgId = computed(() => project.value?.organization_id ?? "");
const projectId = computed(() => project.value?.id ?? "");

const { isOwnerOrAdmin } = useOrgRole(orgId.value);

const projectBase = `/${orgName}/${projectName}`;

const baseTabs = [
  { label: "README", value: "readme", icon: "i-lucide-file-text", to: projectBase },
  { label: "Actions", value: "actions", icon: "i-lucide-zap", to: `${projectBase}/actions` },
  { label: "Agents", value: "agents", icon: "i-lucide-bot-message-square", to: `${projectBase}/agents` },
  { label: "Pages", value: "pages", icon: "i-lucide-earth", to: `${projectBase}/pages` },
];
const tabs = computed(() =>
  isOwnerOrAdmin.value
    ? [...baseTabs, { label: "设置", value: "settings", icon: "i-lucide-settings", to: `${projectBase}/settings` }]
    : baseTabs,
);

const activeTab = computed(() => {
  const path = route.path;
  if (path.endsWith("/actions")) return "actions";
  if (path.endsWith("/agents")) return "agents";
  if (path.endsWith("/pages")) return "pages";
  if (path.endsWith("/settings")) return "settings";
  return "readme";
});
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
            :to="`/${orgName}`"
          />
          <div>
            <h1 class="text-xl font-bold">
              {{ project.full_name }}
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
          v-if="!project.webhook_id"
          color="warning"
          variant="subtle"
        >
          Webhook 未配置
        </UBadge>
      </div>

      <!-- Tab 导航 -->
      <div class="border-b border-gray-200 dark:border-gray-800 mb-6">
        <nav class="flex gap-1 -mb-px">
          <NuxtLink
            v-for="tab in tabs"
            :key="tab.value"
            :to="tab.to"
            class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5"
            :class="
              activeTab === tab.value
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            "
          >
            <UIcon
              :name="tab.icon"
              class="w-4 h-4"
            />
            {{ tab.label }}
          </NuxtLink>
        </nav>
      </div>

      <!-- 子路由内容 -->
      <NuxtPage
        :org-id="orgId"
        :project-id="projectId"
        :project="project"
        :is-owner-or-admin="isOwnerOrAdmin"
      />
    </template>
  </div>
</template>
