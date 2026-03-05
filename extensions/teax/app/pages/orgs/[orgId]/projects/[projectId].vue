<script setup lang="ts">
const route = useRoute();
const router = useRouter();
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

const { data: project, status: projectStatus } = await useFetch<ProjectDetail>(
  `/api/orgs/${orgId}/projects/${projectId}`,
);

const { isOwnerOrAdmin } = useOrgRole(orgId);

const baseTabs = [
  { label: "README", value: "readme", icon: "i-lucide-file-text" },
  { label: "Actions", value: "actions", icon: "i-lucide-zap" },
  { label: "Agents", value: "agents", icon: "i-lucide-bot-message-square" },
  { label: "Pages", value: "pages", icon: "i-lucide-earth" },
];
const tabs = computed(() =>
  isOwnerOrAdmin.value
    ? [...baseTabs, { label: "设置", value: "settings", icon: "i-lucide-settings" }]
    : baseTabs,
);

const validTabValues = computed(() => tabs.value.map((t) => t.value));
const initialTab = validTabValues.value.includes(route.query.tab as string)
  ? (route.query.tab as string)
  : "readme";
const activeTab = ref(initialTab);

watch(activeTab, (tab) => {
  router.replace({ query: { ...route.query, tab } });
});

watch(
  () => route.query.tab,
  (tab) => {
    if (tab && typeof tab === "string" && validTabValues.value.includes(tab)) {
      activeTab.value = tab;
    }
  },
);
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

      <!-- Tab 内容 -->
      <ProjectReadmeTab
        v-if="activeTab === 'readme'"
        :org-id="orgId"
        :project-id="projectId"
      />

      <ClientOnly v-if="activeTab === 'actions'">
        <ProjectActionsTab
          :org-id="orgId"
          :project-id="projectId"
        />
        <template #fallback>
          <ProjectActionsSkeleton />
        </template>
      </ClientOnly>

      <div v-if="activeTab === 'agents'">
        <div class="text-center py-12 text-gray-400">
          <UIcon
            name="i-lucide-bot-message-square"
            class="w-12 h-12 mx-auto mb-3"
          />
          <p>Agent 功能将在 Phase 3 实现</p>
        </div>
      </div>

      <div v-if="activeTab === 'pages'">
        <div class="text-center py-12 text-gray-400">
          <UIcon
            name="i-lucide-earth"
            class="w-12 h-12 mx-auto mb-3"
          />
          <p>Pages 功能将在 Phase 3 实现</p>
        </div>
      </div>

      <ProjectSettingsTab
        v-if="activeTab === 'settings' && isOwnerOrAdmin"
        :org-id="orgId"
        :project-id="projectId"
        :project="project"
      />
    </template>
  </div>
</template>
