<script setup lang="ts">
import type { TeamItem, PermissionGroup, PermissionDef } from "~/types/admin";

definePageMeta({
  layout: "admin",
  middleware: "admin",
});

const route = useRoute();
const toast = useToast();
const orgId = route.params.orgId as string;

const activeTab = ref<"teams" | "permissions">("teams");

const { data: org } = await useFetch(`/api/admin/orgs/${orgId}`);
const { data: teamsData, refresh: refreshTeams } = await useFetch<{
  data: TeamItem[];
}>(`/api/admin/orgs/${orgId}/teams`);
const { data: groupsData, refresh: refreshGroups } = await useFetch<{
  data: PermissionGroup[];
}>(`/api/orgs/${orgId}/permissions`);
const { data: defsData } = await useFetch<{
  data: { permissions: PermissionDef[] };
}>("/api/permissions/definitions");

const teams = computed(() => teamsData.value?.data ?? []);
const allGroups = computed(() => groupsData.value?.data ?? []);
const availablePermissions = computed(
  () => defsData.value?.data?.permissions ?? [],
);

const syncing = ref(false);
async function syncOrg() {
  syncing.value = true;
  try {
    await $fetch(`/api/admin/orgs/${orgId}/sync`, { method: "POST" });
    toast.add({ title: "同步成功", color: "success" });
    await refreshTeams();
  } catch {
    toast.add({ title: "同步失败", color: "error" });
  } finally {
    syncing.value = false;
  }
}
</script>

<template>
  <div>
    <!-- 顶部 -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <UButton
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="ghost"
          size="sm"
          to="/admin/orgs"
        />
        <div>
          <h1 class="text-xl font-bold">
            {{ (org as any)?.displayName || (org as any)?.name || "组织详情" }}
          </h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ teams.length }} 个团队 · {{ allGroups.length }} 个权限组
          </p>
        </div>
      </div>
      <UButton
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="soft"
        :loading="syncing"
        @click="syncOrg"
      >
        同步团队
      </UButton>
    </div>

    <!-- Tab 切换 -->
    <div class="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-800">
      <button
        class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
        :class="
          activeTab === 'teams'
            ? 'border-primary-500 text-primary-600 dark:text-primary-400'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
        "
        @click="activeTab = 'teams'"
      >
        <UIcon
          name="i-lucide-users"
          class="w-4 h-4 mr-1.5 align-text-bottom inline-block"
        />
        团队管理
      </button>
      <button
        class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
        :class="
          activeTab === 'permissions'
            ? 'border-primary-500 text-primary-600 dark:text-primary-400'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
        "
        @click="activeTab = 'permissions'"
      >
        <UIcon
          name="i-lucide-shield"
          class="w-4 h-4 mr-1.5 align-text-bottom inline-block"
        />
        权限组管理
      </button>
    </div>

    <!-- Tab: 团队管理 -->
    <AdminOrgTeamPanel
      v-if="activeTab === 'teams'"
      :org-id="orgId"
      :teams="teams"
      :all-groups="allGroups"
      @refresh-teams="refreshTeams"
    />

    <!-- Tab: 权限组管理 -->
    <AdminOrgPermissionPanel
      v-if="activeTab === 'permissions'"
      :org-id="orgId"
      :all-groups="allGroups"
      :available-permissions="availablePermissions"
      @refresh-groups="refreshGroups"
    />
  </div>
</template>
