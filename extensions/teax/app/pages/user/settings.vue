<script setup lang="ts">
import type { PresetItem } from "~/components/preset/PresetCard.vue";
import type { PresetGroupItem } from "~/components/preset/PresetGroupCard.vue";

const { user } = useUserSession();
const toast = useToast();

// ─── 我的团队 ─────────────────────────────────────────────

interface TeamMemberInfo {
  id: string;
  username: string;
  avatar_url: string | null;
  role: string | null;
}

interface PermissionGroupInfo {
  id: string;
  name: string;
  type: string;
  permissions: string[];
}

interface TeamInfo {
  id: string;
  name: string;
  organization: {
    id: string;
    name: string;
  };
  role: string | null;
  permissions: PermissionGroupInfo[];
  members: TeamMemberInfo[];
}

const { data: teamsData } = await useFetch<{ data: TeamInfo[] }>(
  "/api/user/teams",
  { key: "user-teams" },
);
const teams = computed(() => teamsData.value?.data ?? []);

// 展开的团队 ID
const expandedTeamId = ref<string | null>(null);

function toggleTeam(teamId: string) {
  expandedTeamId.value = expandedTeamId.value === teamId ? null : teamId;
}

// ─── 工作流预设管理 ─────────────────────────────────────────

type WorkflowPreset = PresetItem;
type PresetGroup = PresetGroupItem;

// 独立预设
const { data: presetsData, refresh: refreshPresets } = await useFetch<{ data: WorkflowPreset[] }>(
  "/api/user/workflow-presets",
  { key: "user-workflow-presets" },
);
const presets = computed(() => presetsData.value?.data ?? []);

// 预设组
const { data: groupsData, refresh: refreshGroups } = await useFetch<{ data: PresetGroup[] }>(
  "/api/user/workflow-preset-groups",
  { key: "user-workflow-preset-groups" },
);
const presetGroups = computed(() => groupsData.value?.data ?? []);

// 展开的预设组 ID
const expandedGroupId = ref<string | null>(null);

const deletingGroupId = ref<string | null>(null);
async function deleteGroup(group: PresetGroup) {
  const subCount = group.presets?.length ?? 0;
  const msg = subCount > 0
    ? `确定删除预设组「${group.name}」及其 ${subCount} 个子预设？删除后分享链接将失效。`
    : `确定删除预设组「${group.name}」？删除后分享链接将失效。`;
  if (!confirm(msg)) return;
  deletingGroupId.value = group.id;
  try {
    await $fetch(`/api/user/workflow-preset-groups/${group.id}`, { method: "DELETE" });
    toast.add({ title: "预设组已删除", color: "success" });
    await refreshGroups();
  } catch (err: unknown) {
    const errMsg = (err as { data?: { message?: string } })?.data?.message || "删除失败";
    toast.add({ title: errMsg, color: "error" });
  } finally {
    deletingGroupId.value = null;
  }
}

const deletingPresetId = ref<string | null>(null);
async function deletePreset(preset: WorkflowPreset) {
  if (!confirm(`确定删除预设「${preset.name}」？删除后分享链接将失效。`)) return;
  deletingPresetId.value = preset.id;
  try {
    await $fetch(`/api/user/workflow-presets/${preset.id}`, { method: "DELETE" });
    toast.add({ title: "预设已删除", color: "success" });
    await refreshPresets();
  } catch (err: unknown) {
    const msg = (err as { data?: { message?: string } })?.data?.message || "删除失败";
    toast.add({ title: msg, color: "error" });
  } finally {
    deletingPresetId.value = null;
  }
}

// ─── 飞书绑定状态 ─────────────────────────────────────────

interface FeishuBinding {
  id: string;
  feishu_open_id: string;
  feishu_name: string;
  feishu_avatar: string | null;
  notify_publish: boolean | null;
  notify_approval: boolean | null;
  notify_agent: boolean | null;
  notify_system: boolean | null;
  created_at: string;
}

const { data: bindingData, refresh: refreshBinding } = await useFetch<{ data: FeishuBinding | null }>(
  "/api/user/feishu-binding",
  { key: "user-feishu-binding" },
);
const binding = computed(() => bindingData.value?.data ?? null);

// ─── 解绑飞书 ─────────────────────────────────────────────

const unbinding = ref(false);
async function unbindFeishu() {
  if (!confirm("确定解绑飞书账号？解绑后将无法通过飞书登录或接收通知。")) return;
  unbinding.value = true;
  try {
    await $fetch("/api/user/feishu-binding", { method: "DELETE" });
    toast.add({ title: "已解绑飞书账号", color: "success" });
    await refreshBinding();
  } catch (err: unknown) {
    const msg = (err as { data?: { message?: string } })?.data?.message || "解绑失败";
    toast.add({ title: msg, color: "error" });
  } finally {
    unbinding.value = false;
  }
}

// ─── 绑定飞书（跳转 OAuth） ────────────────────────────────

function bindFeishu() {
  navigateTo("/api/auth/feishu", { external: true });
}

// ─── 通知偏好 ─────────────────────────────────────────────

const notifyPublish = ref(true);
const notifyApproval = ref(true);
const notifyAgent = ref(true);
const notifySystem = ref(false);

watch(binding, (val) => {
  if (val) {
    notifyPublish.value = val.notify_publish ?? true;
    notifyApproval.value = val.notify_approval ?? true;
    notifyAgent.value = val.notify_agent ?? true;
    notifySystem.value = val.notify_system ?? false;
  }
}, { immediate: true });

const savingPreferences = ref(false);
async function savePreferences() {
  savingPreferences.value = true;
  try {
    await $fetch("/api/user/notify-preferences", {
      method: "PATCH",
      body: {
        notify_publish: notifyPublish.value,
        notify_approval: notifyApproval.value,
        notify_agent: notifyAgent.value,
        notify_system: notifySystem.value,
      },
    });
    toast.add({ title: "通知偏好已保存", color: "success" });
    await refreshBinding();
  } catch (err: unknown) {
    const msg = (err as { data?: { message?: string } })?.data?.message || "保存失败";
    toast.add({ title: msg, color: "error" });
  } finally {
    savingPreferences.value = false;
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold mb-6">
      用户设置
    </h1>

    <!-- 账号信息 -->
    <UCard class="mb-6">
      <template #header>
        <h2 class="text-lg font-semibold">
          账号信息
        </h2>
      </template>
      <div class="space-y-4">
        <div class="flex items-center gap-4">
          <UAvatar
            :src="user?.avatar_url || undefined"
            :alt="user?.username"
            size="xl"
          />
          <div class="flex-1">
            <p class="font-semibold text-lg">
              {{ user?.username }}
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ user?.email }}
            </p>
            <UBadge
              v-if="user?.is_admin"
              color="primary"
              variant="subtle"
              size="xs"
              class="mt-1"
            >
              管理员
            </UBadge>
          </div>
        </div>

        <USeparator />

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              用户 ID
            </p>
            <p class="font-mono text-xs mt-1">
              {{ user?.id }}
            </p>
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Gitea 用户名
            </p>
            <p class="font-medium mt-1">
              {{ user?.username }}
            </p>
          </div>
        </div>
      </div>
    </UCard>

    <!-- 飞书绑定 -->
    <UCard class="mb-6">
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">
            飞书绑定
          </h2>
          <UBadge
            :color="binding ? 'success' : 'neutral'"
            variant="subtle"
          >
            {{ binding ? '已绑定' : '未绑定' }}
          </UBadge>
        </div>
      </template>

      <div v-if="binding">
        <div class="space-y-4">
          <div class="flex items-center gap-4">
            <UAvatar
              :src="binding.feishu_avatar || undefined"
              :alt="binding.feishu_name"
              size="lg"
            />
            <div class="flex-1">
              <p class="font-medium">
                {{ binding.feishu_name }}
              </p>
              <p class="text-xs text-gray-400 font-mono">
                {{ binding.feishu_open_id }}
              </p>
            </div>
          </div>

          <USeparator />

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                绑定时间
              </p>
              <p class="text-sm mt-1">
                {{ new Date(binding.created_at).toLocaleString('zh-CN') }}
              </p>
            </div>
            <div>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                绑定 ID
              </p>
              <p class="font-mono text-xs mt-1">
                {{ binding.id }}
              </p>
            </div>
          </div>

          <div class="pt-2">
            <UButton
              color="error"
              variant="outline"
              size="sm"
              icon="i-lucide-unlink"
              :loading="unbinding"
              @click="unbindFeishu"
            >
              解绑飞书账号
            </UButton>
          </div>
        </div>
      </div>

      <div
        v-else
        class="text-center py-6"
      >
        <UIcon
          name="i-lucide-message-square"
          class="w-10 h-10 mx-auto mb-3 text-gray-400"
        />
        <p class="text-gray-500 dark:text-gray-400 mb-4">
          绑定飞书账号以接收构建通知、审批提醒和机器人交互
        </p>
        <UButton
          color="primary"
          icon="i-lucide-link"
          @click="bindFeishu"
        >
          绑定飞书账号
        </UButton>
      </div>
    </UCard>

    <!-- 我的团队 -->
    <UCard class="mb-6">
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">
            我的团队
          </h2>
          <UBadge
            color="neutral"
            variant="subtle"
          >
            {{ teams.length }} 个团队
          </UBadge>
        </div>
      </template>

      <div
        v-if="teams.length === 0"
        class="text-center py-6"
      >
        <UIcon
          name="i-lucide-users"
          class="w-10 h-10 mx-auto mb-3 text-gray-400"
        />
        <p class="text-gray-500 dark:text-gray-400">
          您还未加入任何团队
        </p>
      </div>

      <div
        v-else
        class="space-y-3"
      >
        <div
          v-for="team in teams"
          :key="team.id"
          class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
        >
          <!-- 团队头部（可点击展开） -->
          <div
            class="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            @click="toggleTeam(team.id)"
          >
            <div class="flex items-center gap-3">
              <UIcon
                name="i-lucide-users"
                class="w-5 h-5 text-primary"
              />
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-medium">{{ team.name }}</span>
                  <UBadge
                    v-if="team.role === 'owner'"
                    color="warning"
                    variant="subtle"
                    size="xs"
                  >
                    Owner
                  </UBadge>
                </div>
                <p class="text-xs text-gray-400">
                  {{ team.organization.name }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <UBadge
                color="info"
                variant="subtle"
                size="xs"
              >
                {{ team.permissions.length }} 个权限组
              </UBadge>
              <UBadge
                color="neutral"
                variant="subtle"
                size="xs"
              >
                {{ team.members.length }} 人
              </UBadge>
              <UIcon
                :name="expandedTeamId === team.id ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                class="w-4 h-4 text-gray-400"
              />
            </div>
          </div>

          <!-- 展开内容 -->
          <div
            v-if="expandedTeamId === team.id"
            class="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50/50 dark:bg-gray-800/30"
          >
            <!-- 权限组 -->
            <div class="mb-4">
              <h4 class="text-sm font-medium text-gray-500 mb-2">
                权限组
              </h4>
              <div
                v-if="team.permissions.length === 0"
                class="text-sm text-gray-400"
              >
                暂无权限组
              </div>
              <div
                v-else
                class="space-y-2"
              >
                <div
                  v-for="pg in team.permissions"
                  :key="pg.id"
                  class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                >
                  <div class="flex items-center gap-2 mb-2">
                    <span class="font-medium text-sm">{{ pg.name }}</span>
                    <UBadge
                      :color="pg.type === 'scene' ? 'warning' : pg.type === 'default' ? 'info' : 'neutral'"
                      variant="subtle"
                      size="xs"
                    >
                      {{ pg.type === 'scene' ? '场景' : pg.type === 'default' ? '默认' : '自定义' }}
                    </UBadge>
                  </div>
                  <div class="flex flex-wrap gap-1">
                    <UBadge
                      v-for="perm in pg.permissions"
                      :key="perm"
                      color="neutral"
                      variant="outline"
                      size="xs"
                    >
                      {{ perm }}
                    </UBadge>
                  </div>
                </div>
              </div>
            </div>

            <!-- 团队成员 -->
            <div>
              <h4 class="text-sm font-medium text-gray-500 mb-2">
                团队成员
              </h4>
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="member in team.members"
                  :key="member.id"
                  class="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-full px-3 py-1.5 border border-gray-200 dark:border-gray-700"
                >
                  <UAvatar
                    :src="member.avatar_url || undefined"
                    :alt="member.username"
                    size="2xs"
                  />
                  <span class="text-sm">{{ member.username }}</span>
                  <UBadge
                    v-if="member.role === 'owner'"
                    color="warning"
                    variant="subtle"
                    size="xs"
                  >
                    Owner
                  </UBadge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UCard>

    <!-- 工作流预设 -->
    <UCard class="mb-6">
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">
            工作流预设
          </h2>
          <div class="flex items-center gap-2">
            <UBadge
              color="neutral"
              variant="subtle"
            >
              {{ presetGroups.length }} 个预设组
            </UBadge>
            <UBadge
              color="neutral"
              variant="subtle"
            >
              {{ presets.length }} 个独立预设
            </UBadge>
          </div>
        </div>
      </template>

      <div
        v-if="presetGroups.length === 0 && presets.length === 0"
        class="text-center py-6"
      >
        <UIcon
          name="i-lucide-share-2"
          class="w-10 h-10 mx-auto mb-3 text-gray-400"
        />
        <p class="text-gray-500 dark:text-gray-400">
          暂无工作流预设
        </p>
        <p class="text-sm text-gray-400 mt-1">
          在项目 Actions 页面可创建预设或预设组
        </p>
      </div>

      <div
        v-else
        class="space-y-6"
      >
        <!-- 预设组部分 -->
        <div v-if="presetGroups.length > 0">
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
            预设组
          </h3>
          <div class="space-y-3">
            <PresetGroupCard
              v-for="group in presetGroups"
              :key="group.id"
              :group="group"
              mode="personal"
              :show-delete="true"
              :expanded="expandedGroupId === group.id"
              @update:expanded="expandedGroupId = $event ? group.id : null"
              @delete="deleteGroup"
            />
          </div>
        </div>

        <!-- 独立预设部分 -->
        <div v-if="presets.length > 0">
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
            独立预设
          </h3>
          <div class="space-y-3">
            <PresetCard
              v-for="preset in presets"
              :key="preset.id"
              :preset="preset"
              mode="personal"
              :show-delete="true"
              @delete="deletePreset"
            />
          </div>
        </div>
      </div>
    </UCard>

    <!-- 通知偏好 -->
    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">
          通知偏好
        </h2>
      </template>

      <div
        v-if="!binding"
        class="text-center py-4 text-gray-400"
      >
        <p>请先绑定飞书账号</p>
      </div>

      <div
        v-else
        class="space-y-4"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium">
              构建通知
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              CI/CD 构建成功或失败时发送通知
            </p>
          </div>
          <USwitch v-model="notifyPublish" />
        </div>

        <USeparator />

        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium">
              审批通知
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              审批请求和审批结果通知
            </p>
          </div>
          <USwitch v-model="notifyApproval" />
        </div>

        <USeparator />

        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium">
              Agent 通知
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              AI Agent 运行完成或失败通知
            </p>
          </div>
          <USwitch v-model="notifyAgent" />
        </div>

        <USeparator />

        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium">
              系统通知
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              系统维护、版本更新等通知
            </p>
          </div>
          <USwitch v-model="notifySystem" />
        </div>

        <div class="pt-4">
          <UButton
            color="primary"
            :loading="savingPreferences"
            @click="savePreferences"
          >
            保存偏好
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
