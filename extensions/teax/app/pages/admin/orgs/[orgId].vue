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

const route = useRoute();
const toast = useToast();
const orgId = route.params.orgId as string;

const { data: org } = await useFetch(`/api/admin/orgs/${orgId}`);
const { data: teamsData, refresh: refreshTeams } = await useFetch<{
  data: TeamItem[];
}>(`/api/admin/orgs/${orgId}/teams`);

const teams = computed(() => teamsData.value?.data ?? []);

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
  await fetchMembers();
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
            {{ teams.length }} 个团队
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

      <!-- 成员列表 -->
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
                  :color="row.original.role === 'owner' ? 'primary' : 'neutral'"
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

            <div v-else class="text-center py-8 text-gray-400">
              该团队暂无成员
            </div>
          </UCard>
        </template>

        <div v-else class="flex items-center justify-center h-48 text-gray-400">
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
</template>
