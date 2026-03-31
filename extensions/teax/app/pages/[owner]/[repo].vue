<script setup lang="ts">
import type { ProjectDetailDto } from "~~/server/shared/dto";

const route = useRoute();
const owner = route.params.owner as string;
const repo = route.params.repo as string;

const { data: project, status: projectStatus } = await useFetch<ProjectDetailDto>(
  `/api/repos/${owner}/${repo}`,
);
const toast = useToast();
const updatingWatch = ref(false);

async function toggleWatch() {
  if (!project.value || updatingWatch.value) return;
  const targetWatching = !project.value.watching;
  updatingWatch.value = true;
  try {
    const res = await $fetch<{ data: { watching: boolean; synced_at: string | null } }>(
      `/api/repos/${owner}/${repo}/watch`,
      {
        method: "PUT",
        body: { watching: targetWatching },
      },
    );
    project.value.watching = res.data.watching;
    project.value.watch_synced_at = res.data.synced_at;
    toast.add({
      title: res.data.watching ? "已关注仓库" : "已取消关注",
      color: "success",
    });
  } catch {
    toast.add({ title: "更新 Watch 状态失败", color: "error" });
  } finally {
    updatingWatch.value = false;
  }
}

const { isOwnerOrAdmin } = useOrgRole(owner);

const projectBase = `/${owner}/${repo}`;

const baseTabs = [
  { label: "README", value: "readme", icon: "i-lucide-file-text", to: projectBase },
  { label: "Presets", value: "presets", icon: "i-lucide-bookmark", to: `${projectBase}/presets` },
  { label: "Actions", value: "actions", icon: "i-lucide-zap", to: `${projectBase}/actions` },
  { label: "Agents", value: "agents", icon: "i-lucide-container", to: `${projectBase}/agents` },
  { label: "Pages", value: "pages", icon: "i-lucide-earth", to: `${projectBase}/pages` },
];
const tabs = computed(() =>
  isOwnerOrAdmin.value
    ? [...baseTabs, { label: "Settings", value: "settings", icon: "i-lucide-settings", to: `${projectBase}/settings` }]
    : baseTabs,
);

const activeTab = computed(() => {
  const path = route.path;
  if (path.includes("/presets")) return "presets";
  if (path.includes("/actions") || path.includes("/workflows")) return "actions";
  if (path.includes("/agents")) return "agents";
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
            :to="`/${owner}`"
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

        <div class="flex items-center gap-2">
          <UButton
            :icon="project.watching ? 'i-lucide-eye-off' : 'i-lucide-eye'"
            color="neutral"
            variant="soft"
            size="sm"
            :loading="updatingWatch"
            @click="toggleWatch"
          >
            {{ project.watching ? "Watching" : "Watch" }}
          </UButton>
          <UBadge
            color="neutral"
            variant="subtle"
          >
            系统 Webhook
          </UBadge>
        </div>
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
        :owner="owner"
        :repo="repo"
        :project="project"
        :is-owner-or-admin="isOwnerOrAdmin"
      />
    </template>
  </div>
</template>
