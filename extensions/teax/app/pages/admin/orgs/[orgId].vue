<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: "admin",
});

interface TeamItem {
  id: string;
  organizationId: string;
  giteaTeamId: number;
  name: string;
  description: string | null;
  syncedAt: string | null;
  createdAt: string;
  memberCount: number;
}

interface MemberItem {
  id: string;
  teamId: string;
  userId: string;
  role: string;
  joinedAt: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  giteaId: number;
}

interface PermissionGroup {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
}

interface TeamPermissionAssignment {
  id: string;
  teamId: string;
  permissionGroupId: string;
  groupName: string;
  groupDescription: string | null;
  permissions: string[];
}

const route = useRoute();
const toast = useToast();
const orgId = route.params.orgId as string;

// Tab 切换
const activeTab = ref<"teams" | "permissions">("teams");

const { data: org } = await useFetch(`/api/admin/orgs/${orgId}`);
const { data: teamsData, refresh: refreshTeams } = await useFetch<{
  data: TeamItem[];
}>(`/api/admin/orgs/${orgId}/teams`);

const teams = computed(() => teamsData.value?.data ?? []);

// ─── 团队成员管理 ───

const selectedTeamId = ref<string | null>(null);
const members = ref<MemberItem[]>([]);
const membersLoading = ref(false);

async function fetchMembers() {
  if (!selectedTeamId.value) return;
  membersLoading.value = true;
  try {
    const res = await $fetch<{ data: MemberItem[] }>(
      `/api/admin/orgs/${orgId}/teams/${selectedTeamId.value}/members`,
    );
    members.value = res.data ?? [];
  } catch {
    members.value = [];
  } finally {
    membersLoading.value = false;
  }
}

async function refreshMembers() {
  await fetchMembers();
}

async function selectTeam(teamId: string) {
  selectedTeamId.value = teamId;
  await Promise.all([fetchMembers(), fetchTeamPermissions()]);
}

async function removeMember(member: MemberItem) {
  if (!selectedTeamId.value) return;
  try {
    await $fetch(
      `/api/admin/orgs/${orgId}/teams/${selectedTeamId.value}/members/${member.id}`,
      { method: "DELETE" },
    );
    toast.add({ title: `已移除 ${member.username}`, color: "success" });
    await refreshMembers();
    await refreshTeams();
  } catch {
    toast.add({ title: "移除失败", color: "error" });
  }
}

async function changeRole(member: MemberItem, newRole: string) {
  if (!selectedTeamId.value) return;
  try {
    await $fetch(
      `/api/admin/orgs/${orgId}/teams/${selectedTeamId.value}/members/${member.id}`,
      { method: "PATCH", body: { role: newRole } },
    );
    toast.add({
      title: `已将 ${member.username} 设为 ${newRole}`,
      color: "success",
    });
    await refreshMembers();
  } catch {
    toast.add({ title: "操作失败", color: "error" });
  }
}

// ─── 团队权限分配 ───

const allGroups = ref<PermissionGroup[]>([]);
const teamPermissions = ref<TeamPermissionAssignment[]>([]);
const permLoading = ref(false);

async function fetchAllGroups() {
  try {
    const res = await $fetch<{ data: PermissionGroup[] }>(
      `/api/orgs/${orgId}/permissions`,
    );
    allGroups.value = res.data ?? [];
  } catch {
    allGroups.value = [];
  }
}

async function fetchTeamPermissions() {
  if (!selectedTeamId.value) return;
  permLoading.value = true;
  try {
    const res = await $fetch<{ data: TeamPermissionAssignment[] }>(
      `/api/orgs/${orgId}/teams/${selectedTeamId.value}/assigned-permissions`,
    );
    teamPermissions.value = res.data ?? [];
  } catch {
    teamPermissions.value = [];
  } finally {
    permLoading.value = false;
  }
}

async function assignPermission(groupId: string) {
  if (!selectedTeamId.value) return;
  try {
    await $fetch(
      `/api/orgs/${orgId}/teams/${selectedTeamId.value}/assigned-permissions`,
      { method: "POST", body: { permissionGroupId: groupId } },
    );
    toast.add({ title: "权限组已分配", color: "success" });
    await fetchTeamPermissions();
  } catch {
    toast.add({ title: "分配失败", color: "error" });
  }
}

async function removePermission(assignmentId: string) {
  if (!selectedTeamId.value) return;
  try {
    await $fetch(
      `/api/orgs/${orgId}/teams/${selectedTeamId.value}/assigned-permissions/${assignmentId}`,
      { method: "DELETE" },
    );
    toast.add({ title: "权限组已移除", color: "success" });
    await fetchTeamPermissions();
  } catch {
    toast.add({ title: "移除失败", color: "error" });
  }
}

const unassignedGroups = computed(() => {
  const assignedIds = new Set(
    teamPermissions.value.map(tp => tp.permissionGroupId),
  );
  return allGroups.value.filter(g => !assignedIds.has(g.id));
});

// ─── 权限组 CRUD ───

const { data: defsData } = await useFetch<{
  data: { permissions: { key: string; label: string; group: string }[] };
}>("/api/permissions/definitions");

const availablePermissions = computed(
  () => defsData.value?.data?.permissions ?? [],
);

const showGroupForm = ref(false);
const editingGroup = ref<PermissionGroup | null>(null);
const formName = ref("");
const formDescription = ref("");
const formPermissions = ref<string[]>([]);
const formLoading = ref(false);

function openCreateGroup() {
  editingGroup.value = null;
  formName.value = "";
  formDescription.value = "";
  formPermissions.value = [];
  showGroupForm.value = true;
}

function openEditGroup(group: PermissionGroup) {
  editingGroup.value = group;
  formName.value = group.name;
  formDescription.value = group.description || "";
  formPermissions.value = [...(group.permissions || [])];
  showGroupForm.value = true;
}

function cancelGroupForm() {
  showGroupForm.value = false;
  editingGroup.value = null;
}

function togglePermission(key: string) {
  const idx = formPermissions.value.indexOf(key);
  if (idx >= 0) {
    formPermissions.value.splice(idx, 1);
  } else {
    formPermissions.value.push(key);
  }
}

async function saveGroup() {
  if (!formName.value.trim()) {
    toast.add({ title: "名称不能为空", color: "error" });
    return;
  }
  formLoading.value = true;
  try {
    if (editingGroup.value) {
      await $fetch(`/api/orgs/${orgId}/permissions/${editingGroup.value.id}`, {
        method: "PUT",
        body: {
          name: formName.value,
          description: formDescription.value,
          permissions: formPermissions.value,
        },
      });
      toast.add({ title: "权限组已更新", color: "success" });
    } else {
      await $fetch(`/api/orgs/${orgId}/permissions`, {
        method: "POST",
        body: {
          name: formName.value,
          description: formDescription.value,
          permissions: formPermissions.value,
        },
      });
      toast.add({ title: "权限组已创建", color: "success" });
    }
    showGroupForm.value = false;
    editingGroup.value = null;
    await fetchAllGroups();
  } catch {
    toast.add({ title: "操作失败", color: "error" });
  } finally {
    formLoading.value = false;
  }
}

async function deleteGroup(group: PermissionGroup) {
  if (
    !confirm(`确定删除权限组「${group.name}」？关联的团队权限分配也会被移除。`)
  )
    return;
  try {
    await $fetch(`/api/orgs/${orgId}/permissions/${group.id}`, {
      method: "DELETE",
    });
    toast.add({ title: "权限组已删除", color: "success" });
    await fetchAllGroups();
  } catch {
    toast.add({ title: "删除失败", color: "error" });
  }
}

function getPermissionLabel(key: string) {
  return availablePermissions.value.find(p => p.key === key)?.label || key;
}

// ─── 同步 ───

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

// 初始加载权限组
fetchAllGroups();
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

    <!-- ====== Tab: 团队管理 ====== -->
    <div v-if="activeTab === 'teams'">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- 团队列表 -->
        <div class="lg:col-span-1 space-y-2">
          <h2
            class="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2"
          >
            团队列表
          </h2>
          <button
            v-for="team in teams"
            :key="team.id"
            class="w-full text-left p-3 rounded-lg border transition-colors"
            :class="
              selectedTeamId === team.id
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
                : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900'
            "
            @click="selectTeam(team.id)"
          >
            <div class="font-medium text-sm">
              {{ team.name }}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {{ team.memberCount }} 名成员
            </div>
          </button>

          <div
            v-if="teams.length === 0"
            class="text-center py-6 text-sm text-gray-400"
          >
            暂无团队，请先同步
          </div>
        </div>

        <!-- 成员与权限分配 -->
        <div class="lg:col-span-2">
          <template v-if="selectedTeamId">
            <h2
              class="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3"
            >
              团队成员
            </h2>
            <UCard>
              <UTable
                v-if="members.length > 0"
                :data="members"
                :columns="[
                  { accessorKey: 'username', header: '用户名' },
                  { accessorKey: 'email', header: '邮箱' },
                  { accessorKey: 'role', header: '角色' },
                  { accessorKey: 'actions', header: '操作' },
                ]"
              >
                <template #username-cell="{ row }">
                  <div class="flex items-center gap-2">
                    <UAvatar
                      :src="row.original.avatarUrl || undefined"
                      :alt="row.original.username"
                      size="xs"
                    />
                    <span class="font-medium">{{ row.original.username }}</span>
                  </div>
                </template>

                <template #role-cell="{ row }">
                  <UBadge
                    :color="
                      row.original.role === 'owner' ? 'primary' : 'neutral'
                    "
                    variant="subtle"
                    size="sm"
                  >
                    {{ row.original.role === "owner" ? "Owner" : "Member" }}
                  </UBadge>
                </template>

                <template #actions-cell="{ row }">
                  <div class="flex items-center gap-1">
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="soft"
                      @click="
                        changeRole(
                          row.original,
                          row.original.role === 'owner' ? 'member' : 'owner',
                        )
                      "
                    >
                      {{
                        row.original.role === "owner"
                          ? "设为 Member"
                          : "设为 Owner"
                      }}
                    </UButton>
                    <UButton
                      size="xs"
                      color="error"
                      variant="soft"
                      @click="removeMember(row.original)"
                    >
                      移除
                    </UButton>
                  </div>
                </template>
              </UTable>

              <div
                v-else
                class="text-center py-8 text-gray-400"
              >
                该团队暂无成员
              </div>
            </UCard>

            <!-- 团队已分配权限组 -->
            <h2
              class="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 mt-6"
            >
              已分配权限组
            </h2>
            <UCard>
              <div
                v-if="teamPermissions.length > 0"
                class="space-y-2"
              >
                <div
                  v-for="tp in teamPermissions"
                  :key="tp.id"
                  class="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-900"
                >
                  <div>
                    <span class="font-medium text-sm">{{ tp.groupName }}</span>
                    <span
                      v-if="tp.groupDescription"
                      class="text-xs text-gray-500 dark:text-gray-400 ml-2"
                    >
                      {{ tp.groupDescription }}
                    </span>
                  </div>
                  <UButton
                    size="xs"
                    color="error"
                    variant="soft"
                    icon="i-lucide-x"
                    @click="removePermission(tp.id)"
                  />
                </div>
              </div>
              <div
                v-else
                class="text-sm text-gray-400 py-2"
              >
                该团队暂未分配权限组
              </div>

              <!-- 添加权限组 -->
              <div
                v-if="unassignedGroups.length > 0"
                class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800"
              >
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  添加权限组
                </p>
                <div class="flex flex-wrap gap-2">
                  <UButton
                    v-for="group in unassignedGroups"
                    :key="group.id"
                    size="xs"
                    color="primary"
                    variant="soft"
                    icon="i-lucide-plus"
                    @click="assignPermission(group.id)"
                  >
                    {{ group.name }}
                  </UButton>
                </div>
              </div>
              <div
                v-else-if="allGroups.length === 0"
                class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800"
              >
                <p class="text-xs text-gray-400">
                  暂无权限组，请切换到「权限组管理」创建
                </p>
              </div>
            </UCard>
          </template>

          <div
            v-else
            class="flex items-center justify-center h-48 text-gray-400"
          >
            <div class="text-center">
              <UIcon
                name="i-lucide-mouse-pointer-click"
                class="w-8 h-8 mx-auto mb-2"
              />
              <p>选择左侧团队查看成员</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ====== Tab: 权限组管理 ====== -->
    <div v-if="activeTab === 'permissions'">
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          创建权限组并分配给团队，团队成员自动继承权限
        </p>
        <UButton
          icon="i-lucide-plus"
          color="primary"
          @click="openCreateGroup"
        >
          新建权限组
        </UButton>
      </div>

      <div class="space-y-4">
        <UCard
          v-for="group in allGroups"
          :key="group.id"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <h3 class="font-semibold text-base">
                {{ group.name }}
              </h3>
              <p
                v-if="group.description"
                class="text-sm text-gray-500 dark:text-gray-400 mt-1"
              >
                {{ group.description }}
              </p>
              <div
                v-if="group.permissions && group.permissions.length > 0"
                class="flex flex-wrap gap-1.5 mt-3"
              >
                <UBadge
                  v-for="perm in group.permissions"
                  :key="perm"
                  color="primary"
                  variant="subtle"
                  size="sm"
                >
                  {{ getPermissionLabel(perm) }}
                </UBadge>
              </div>
              <p
                v-else
                class="text-sm text-gray-400 mt-2"
              >
                未分配权限（只读）
              </p>
            </div>
            <div class="flex items-center gap-1 ml-4 shrink-0">
              <UButton
                size="xs"
                color="neutral"
                variant="soft"
                icon="i-lucide-pencil"
                @click="openEditGroup(group)"
              >
                编辑
              </UButton>
              <UButton
                size="xs"
                color="error"
                variant="soft"
                icon="i-lucide-trash-2"
                @click="deleteGroup(group)"
              >
                删除
              </UButton>
            </div>
          </div>
        </UCard>

        <div
          v-if="allGroups.length === 0"
          class="text-center py-12 text-gray-400"
        >
          <UIcon
            name="i-lucide-shield"
            class="w-12 h-12 mx-auto mb-3"
          />
          <p>暂无权限组</p>
          <p class="text-sm mt-1">
            点击"新建权限组"创建第一个权限组
          </p>
        </div>
      </div>
    </div>

    <!-- 权限组 创建/编辑 Modal -->
    <UModal v-model:open="showGroupForm">
      <template #content>
        <div class="p-6">
          <h2 class="text-lg font-bold mb-4">
            {{ editingGroup ? "编辑权限组" : "新建权限组" }}
          </h2>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">名称</label>
              <UInput
                v-model="formName"
                placeholder="如：开发者、管理员、只读"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-1">描述</label>
              <UTextarea
                v-model="formDescription"
                placeholder="权限组用途说明"
                :rows="2"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">权限</label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="perm in availablePermissions"
                  :key="perm.key"
                  type="button"
                  class="flex items-center gap-2 p-2 rounded-lg border text-sm text-left transition-colors"
                  :class="
                    formPermissions.includes(perm.key)
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300'
                      : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900'
                  "
                  @click="togglePermission(perm.key)"
                >
                  <UIcon
                    :name="
                      formPermissions.includes(perm.key)
                        ? 'i-lucide-check-square'
                        : 'i-lucide-square'
                    "
                    class="w-4 h-4 shrink-0"
                  />
                  {{ perm.label }}
                </button>
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-2 mt-6">
            <UButton
              color="neutral"
              variant="soft"
              @click="cancelGroupForm"
            >
              取消
            </UButton>
            <UButton
              color="primary"
              :loading="formLoading"
              @click="saveGroup"
            >
              {{ editingGroup ? "保存" : "创建" }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
