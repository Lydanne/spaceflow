<script setup lang="ts">
import type {
  TeamItem,
  MemberItem,
  PermissionGroup,
  TeamPermissionAssignment,
} from "~/types/admin";

const props = withDefaults(
  defineProps<{
    orgName: string;
    teams: TeamItem[];
    allGroups: PermissionGroup[];
    apiPrefix?: string;
    showMemberActions?: boolean;
  }>(),
  {
    apiPrefix: "/api/admin/orgs",
    showMemberActions: true,
  },
);

const emit = defineEmits<{
  refreshTeams: [];
}>();

const toast = useToast();

const selectedTeamName = ref<string | null>(null);
const members = ref<MemberItem[]>([]);
const membersLoading = ref(false);
const teamPermissions = ref<TeamPermissionAssignment[]>([]);
const permLoading = ref(false);

async function fetchMembers() {
  if (!selectedTeamName.value) return;
  membersLoading.value = true;
  try {
    const res = await $fetch<{ data: MemberItem[] }>(
      `${props.apiPrefix}/${props.orgName}/teams/${selectedTeamName.value}/members`,
    );
    members.value = res.data ?? [];
  } catch {
    members.value = [];
  } finally {
    membersLoading.value = false;
  }
}

async function fetchTeamPermissions() {
  if (!selectedTeamName.value) return;
  permLoading.value = true;
  try {
    const res = await $fetch<{ data: TeamPermissionAssignment[] }>(
      `/api/orgs/${props.orgName}/teams/${selectedTeamName.value}/assigned-permissions`,
    );
    teamPermissions.value = res.data ?? [];
  } catch {
    teamPermissions.value = [];
  } finally {
    permLoading.value = false;
  }
}

async function selectTeam(teamName: string) {
  selectedTeamName.value = teamName;
  await Promise.all([fetchMembers(), fetchTeamPermissions()]);
}

async function removeMember(member: MemberItem) {
  if (!selectedTeamName.value) return;
  try {
    await $fetch(
      `${props.apiPrefix}/${props.orgName}/teams/${selectedTeamName.value}/members/${member.id}`,
      { method: "DELETE" },
    );
    toast.add({ title: `已移除 ${member.username}`, color: "success" });
    await fetchMembers();
    emit("refreshTeams");
  } catch {
    toast.add({ title: "移除失败", color: "error" });
  }
}

async function changeRole(member: MemberItem, newRole: string) {
  if (!selectedTeamName.value) return;
  try {
    await $fetch(
      `${props.apiPrefix}/${props.orgName}/teams/${selectedTeamName.value}/members/${member.id}`,
      { method: "PATCH", body: { role: newRole } },
    );
    toast.add({
      title: `已将 ${member.username} 设为 ${newRole}`,
      color: "success",
    });
    await fetchMembers();
  } catch {
    toast.add({ title: "操作失败", color: "error" });
  }
}

async function assignPermission(groupId: string) {
  if (!selectedTeamName.value) return;
  try {
    await $fetch(
      `/api/orgs/${props.orgName}/teams/${selectedTeamName.value}/assigned-permissions`,
      { method: "POST", body: { permission_group_id: groupId } },
    );
    toast.add({ title: "权限组已分配", color: "success" });
    await fetchTeamPermissions();
  } catch {
    toast.add({ title: "分配失败", color: "error" });
  }
}

async function removePermission(assignmentId: string) {
  if (!selectedTeamName.value) return;
  try {
    await $fetch(
      `/api/orgs/${props.orgName}/teams/${selectedTeamName.value}/assigned-permissions/${assignmentId}`,
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
    teamPermissions.value.map((tp) => tp.permission_group_id),
  );
  return props.allGroups.filter((g) => !assignedIds.has(g.id));
});

const memberColumns = computed(() => {
  const cols = [
    { accessorKey: "username", header: "用户名" },
    { accessorKey: "email", header: "邮箱" },
    { accessorKey: "role", header: "角色" },
  ];
  if (props.showMemberActions) {
    cols.push({ accessorKey: "actions", header: "操作" });
  }
  return cols;
});
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- 团队列表 -->
    <div class="lg:col-span-1 space-y-2">
      <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">
        团队列表
      </h2>
      <button
        v-for="team in teams"
        :key="team.id"
        class="w-full text-left p-3 rounded-lg border transition-colors"
        :class="
          selectedTeamName === team.name
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
            : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900'
        "
        @click="selectTeam(team.name)"
      >
        <div class="font-medium text-sm">
          {{ team.name }}
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {{ team.member_count }} 名成员
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
      <template v-if="selectedTeamName">
        <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
          团队成员
        </h2>
        <UCard>
          <UTable
            v-if="members.length > 0"
            :data="members"
            :columns="memberColumns"
          >
            <template #username-cell="{ row }">
              <div class="flex items-center gap-2">
                <UAvatar
                  :src="row.original.avatar_url || undefined"
                  :alt="row.original.username"
                  size="xs"
                />
                <span class="font-medium">{{ row.original.username }}</span>
              </div>
            </template>

            <template #role-cell="{ row }">
              <UBadge
                :color="row.original.role === 'owner' ? 'primary' : 'neutral'"
                variant="subtle"
                size="sm"
              >
                {{ row.original.role === "owner" ? "Owner" : "Member" }}
              </UBadge>
            </template>

            <template
              v-if="showMemberActions"
              #actions-cell="{ row }"
            >
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
                    row.original.role === "owner" ? "设为 Member" : "设为 Owner"
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
                <span class="font-medium text-sm">{{ tp.group_name }}</span>
                <span
                  v-if="tp.group_description"
                  class="text-xs text-gray-500 dark:text-gray-400 ml-2"
                >
                  {{ tp.group_description }}
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
</template>
