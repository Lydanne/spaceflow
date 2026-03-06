<script setup lang="ts">
import type { TeamItem, PermissionGroup, PermissionDef } from "~/types/admin";

const route = useRoute();
const toast = useToast();
const orgName = route.params.orgName as string;

const { data: roleData } = await useFetch<{ role: string }>(
  `/api/orgs/${orgName}/role`,
  { key: `org-role-${orgName}` },
);
const isOwnerOrAdmin = computed(() => {
  const role = roleData.value?.role ?? "member";
  return role === "admin" || role === "owner";
});

if (!isOwnerOrAdmin.value) {
  await navigateTo(`/${orgName}`, { replace: true });
}

const { data: teamsData, refresh: refreshTeams } = useFetch<{
  data: TeamItem[];
}>(`/api/orgs/${orgName}/teams`, { lazy: true });
const { data: groupsData, refresh: refreshGroups } = useFetch<{
  data: PermissionGroup[];
}>(`/api/orgs/${orgName}/permissions`, { lazy: true });
const { data: defsData } = useFetch<{
  data: { permissions: PermissionDef[] };
}>("/api/permissions/definitions", { lazy: true });
const { data: orgDetailData } = useFetch<{
  data: { settings: Record<string, unknown> };
}>(`/api/orgs/${orgName}/detail`, { key: `org-detail-${orgName}`, lazy: true });

const teams = computed(() => teamsData.value?.data ?? []);
const allGroups = computed(() => groupsData.value?.data ?? []);
const availablePermissions = computed(
  () => defsData.value?.data?.permissions ?? [],
);

// provide 给子路由页面使用
provide("orgName", orgName);
provide("isOwnerOrAdmin", isOwnerOrAdmin);
provide("teams", teams);
provide("allGroups", allGroups);
provide("availablePermissions", availablePermissions);
provide("refreshTeams", refreshTeams);
provide("refreshGroups", refreshGroups);
provide("orgDetailData", orgDetailData);

const syncing = ref(false);
async function syncOrg() {
  syncing.value = true;
  try {
    await $fetch(`/api/orgs/${orgName}/sync`, { method: "POST" });
    toast.add({ title: "同步成功", color: "success" });
    await refreshTeams();
  } catch {
    toast.add({ title: "同步失败", color: "error" });
  } finally {
    syncing.value = false;
  }
}

const tabs = [
  { key: "teams", label: "团队管理", icon: "i-lucide-users", requireAdmin: false },
  { key: "permissions", label: "权限组管理", icon: "i-lucide-shield", requireAdmin: true },
  { key: "feishu", label: "通知规则", icon: "i-simple-icons-bytedance", requireAdmin: true },
];

const activeTab = computed(() => {
  const path = route.path;
  for (const tab of tabs) {
    if (path.endsWith(`/${tab.key}`)) return tab.key;
  }
  return "teams";
});
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-8">
    <!-- 顶部 -->
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
            组织设置
          </h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ teams.length }} 个团队 · {{ allGroups.length }} 个权限组
          </p>
        </div>
      </div>
      <UButton
        v-if="isOwnerOrAdmin"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="soft"
        :loading="syncing"
        @click="syncOrg"
      >
        同步团队
      </UButton>
    </div>

    <!-- Tab 导航 -->
    <div class="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-800">
      <template
        v-for="tab in tabs"
        :key="tab.key"
      >
        <NuxtLink
          v-if="!tab.requireAdmin || isOwnerOrAdmin"
          :to="`/org/${orgName}/settings/${tab.key}`"
          class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
          :class="
            activeTab === tab.key
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          "
        >
          <UIcon
            :name="tab.icon"
            class="w-4 h-4 mr-1.5 align-text-bottom inline-block"
          />
          {{ tab.label }}
        </NuxtLink>
      </template>
    </div>

    <!-- 子路由内容 -->
    <NuxtPage />
  </div>
</template>
