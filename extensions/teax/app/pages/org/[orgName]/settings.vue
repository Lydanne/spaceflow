<script setup lang="ts">
import type { TeamItem, PermissionGroup, PermissionDef } from "~/types/admin";

const route = useRoute();
const toast = useToast();
const orgName = route.params.orgName as string;

const activeTab = ref<"teams" | "permissions" | "feishu">("teams");

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

// ─── 飞书配置 ────────────────────────────────────────
interface OrgSettings {
  feishuChatId: string;
}

const orgSettings = reactive<OrgSettings>({
  feishuChatId: "",
});
const savingFeishu = ref(false);

const { data: orgDetailData } = await useFetch<{
  data: { settings: Record<string, unknown> };
}>(`/api/orgs/${orgName}/detail`, { key: `org-detail-${orgName}` });

watch(
  () => orgDetailData.value?.data?.settings,
  (s) => {
    if (!s) return;
    const os = s as unknown as OrgSettings;
    orgSettings.feishuChatId = os.feishuChatId ?? "";
  },
  { immediate: true },
);

async function saveFeishuSettings() {
  savingFeishu.value = true;
  try {
    await $fetch(`/api/orgs/${orgName}/settings`, {
      method: "PATCH",
      body: { feishuChatId: orgSettings.feishuChatId },
    });
    toast.add({ title: "飞书设置已保存", color: "success" });
  } catch {
    toast.add({ title: "保存失败", color: "error" });
  } finally {
    savingFeishu.value = false;
  }
}

const { data: teamsData, refresh: refreshTeams } = await useFetch<{
  data: TeamItem[];
}>(`/api/orgs/${orgName}/teams`);
const { data: groupsData, refresh: refreshGroups } = await useFetch<{
  data: PermissionGroup[];
}>(`/api/orgs/${orgName}/permissions`);
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
    await $fetch(`/api/orgs/${orgName}/sync`, { method: "POST" });
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
      <button
        v-if="isOwnerOrAdmin"
        class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
        :class="
          activeTab === 'feishu'
            ? 'border-primary-500 text-primary-600 dark:text-primary-400'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
        "
        @click="activeTab = 'feishu'"
      >
        <UIcon
          name="i-simple-icons-lark"
          class="w-4 h-4 mr-1.5 align-text-bottom inline-block"
        />
        飞书配置
      </button>
    </div>

    <!-- Tab: 团队管理 -->
    <AdminOrgTeamPanel
      v-if="activeTab === 'teams'"
      :org-name="orgName"
      :teams="teams"
      :all-groups="allGroups"
      api-prefix="/api/orgs"
      :show-member-actions="false"
      @refresh-teams="refreshTeams"
    />

    <!-- Tab: 权限组管理 -->
    <AdminOrgPermissionPanel
      v-if="activeTab === 'permissions'"
      :org-name="orgName"
      :all-groups="allGroups"
      :available-permissions="availablePermissions"
      :show-repo-scope="false"
      @refresh-groups="refreshGroups"
    />

    <!-- Tab: 飞书配置 -->
    <div v-if="activeTab === 'feishu'">
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon
              name="i-simple-icons-lark"
              class="w-4 h-4"
            />
            <h3 class="font-semibold">
              飞书通知配置
            </h3>
          </div>
        </template>
        <div class="space-y-5">
          <div>
            <label class="block text-sm font-medium mb-1">
              默认飞书群 Chat ID
            </label>
            <UInput
              v-model="orgSettings.feishuChatId"
              placeholder="oc_xxxxxxxxxxxxxxxx"
              size="sm"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              组织的默认通知群聊。仓库未单独配置时将使用此群聊发送通知。
            </p>
          </div>

          <div class="flex justify-end pt-2">
            <UButton
              color="primary"
              :loading="savingFeishu"
              @click="saveFeishuSettings"
            >
              保存设置
            </UButton>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
