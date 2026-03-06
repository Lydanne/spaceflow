<script setup lang="ts">
import type { TeamItem, PermissionGroup, PermissionDef } from "~/types/admin";

const route = useRoute();
const toast = useToast();
const orgName = route.params.orgName as string;

const { data: org } = await useFetch<{
  id: string;
  name: string;
}>(`/api/resolve/${orgName}`);

if (!org.value) {
  throw createError({ statusCode: 404, message: "Organization not found" });
}

const orgId = org.value.id;

const activeTab = ref<"teams" | "permissions">("teams");

const { isOwnerOrAdmin } = useOrgRole(orgId);

if (!isOwnerOrAdmin.value) {
  await navigateTo(`/${orgName}`, { replace: true });
}

const { data: teamsData, refresh: refreshTeams } = await useFetch<{
  data: TeamItem[];
}>(`/api/orgs/${orgId}/teams`);
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
    await $fetch(`/api/orgs/${orgId}/sync`, { method: "POST" });
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
        v-if="isOwnerOrAdmin"
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
      api-prefix="/api/orgs"
      :show-member-actions="false"
      @refresh-teams="refreshTeams"
    />

    <!-- Tab: 权限组管理 -->
    <AdminOrgPermissionPanel
      v-if="activeTab === 'permissions'"
      :org-id="orgId"
      :all-groups="allGroups"
      :available-permissions="availablePermissions"
      :show-project-scope="false"
      @refresh-groups="refreshGroups"
    />
  </div>
</template>
