<script setup lang="ts">
import type {
  RepoPresetGroupItemDto,
  RepoPresetItemDto,
  RepoPresetsResponseDto,
} from "~~/server/shared/dto";

const route = useRoute();
const owner = route.params.owner as string;
const repo = route.params.repo as string;
const { user } = useUserSession();

const { data, pending, refresh } = await useFetch<RepoPresetsResponseDto>(`/api/repos/${owner}/${repo}/presets`);

const orgPresets = computed(() => data.value?.org_presets ?? []);
const myPresets = computed(() => data.value?.my_presets ?? []);
const presetGroups = computed(() => data.value?.preset_groups ?? []);

type OrgPresetCardItem
  = | (RepoPresetGroupItemDto & { kind: "group" })
    | (RepoPresetItemDto & { kind: "preset" });

const orgPresetCards = computed<OrgPresetCardItem[]>(() => {
  const publicGroups = presetGroups.value
    .filter((group) => group.is_public)
    .map((group) => ({ ...group, kind: "group" as const }));

  const publicPresets = orgPresets.value
    .map((preset) => ({ ...preset, kind: "preset" as const }));

  return [...publicGroups, ...publicPresets];
});

const myPrivatePresetGroups = computed(() =>
  presetGroups.value.filter((group) => !group.is_public && group.created_by === user.value?.id),
);

const toast = useToast();

// 复制链接
function copyPresetUrl(preset: { share_token: string }) {
  const url = `${window.location.origin}/workflows/${preset.share_token}`;
  navigator.clipboard.writeText(url);
  toast.add({ title: "链接已复制", color: "success" });
}

function copyGroupUrl(group: { share_token: string }) {
  const url = `${window.location.origin}/workflow-groups/${group.share_token}`;
  navigator.clipboard.writeText(url);
  toast.add({ title: "链接已复制", color: "success" });
}

// 公开/私有切换
async function togglePresetPublic(preset: RepoPresetItemDto) {
  try {
    await $fetch(`/api/repos/${owner}/${repo}/workflow-presets/${preset.id}`, {
      method: "PATCH",
      body: { is_public: !preset.is_public },
    });
    toast.add({
      title: preset.is_public ? "已设为私有" : "已设为公开",
      color: "success",
    });
    await refresh();
  } catch {
    toast.add({ title: "操作失败", color: "error" });
  }
}

// async function toggleGroupPublic(group: RepoPresetGroupItem) {
//   try {
//     await $fetch(`/api/workflow-preset-groups/${group.id}`, {
//       method: "PATCH",
//       body: { is_public: !group.is_public },
//     });
//     toast.add({
//       title: group.is_public ? "已设为私有" : "已设为公开",
//       color: "success",
//     });
//     await refresh();
//   } catch {
//     toast.add({ title: "操作失败", color: "error" });
//   }
// }

function canManagePreset(preset: RepoPresetItemDto): boolean {
  return preset.created_by === user.value?.id || user.value?.is_admin === true;
}

function canManageGroup(group: RepoPresetGroupItemDto): boolean {
  return group.created_by === user.value?.id || user.value?.is_admin === true;
}

async function toggleGroupPublic(group: RepoPresetGroupItemDto) {
  if (!canManageGroup(group)) {
    toast.add({ title: "无权限修改该预设组", color: "warning" });
    return;
  }
  try {
    await $fetch(`/api/orgs/${owner}/preset-groups/${group.id}`, {
      method: "PATCH",
      body: { is_public: !group.is_public },
    });
    toast.add({
      title: group.is_public ? "已设为私有" : "已设为公开",
      color: "success",
    });
    await refresh();
  } catch {
    toast.add({ title: "操作失败", color: "error" });
  }
}

async function deleteGroup(group: RepoPresetGroupItemDto) {
  if (!canManageGroup(group)) {
    toast.add({ title: "无权限删除该预设组", color: "warning" });
    return;
  }
  if (!confirm(`确定要删除预设组「${group.name}」吗？`)) return;
  try {
    await $fetch(`/api/user/workflow-preset-groups/${group.id}`, {
      method: "DELETE",
    });
    toast.add({ title: "删除成功", color: "success" });
    await refresh();
  } catch {
    toast.add({ title: "删除失败", color: "error" });
  }
}

// 删除预设
async function deletePreset(preset: RepoPresetItemDto) {
  if (!confirm(`确定要删除预设「${preset.name}」吗？`)) return;
  try {
    await $fetch(`/api/repos/${owner}/${repo}/workflow-presets/${preset.id}`, {
      method: "DELETE",
    });
    toast.add({ title: "删除成功", color: "success" });
    await refresh();
  } catch {
    toast.add({ title: "删除失败", color: "error" });
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- 加载中 -->
    <div
      v-if="pending"
      class="flex justify-center py-12"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-6 h-6 animate-spin text-gray-400"
      />
    </div>

    <template v-else>
      <!-- 组织预设 -->
      <div
        v-if="orgPresetCards.length > 0"
        class="space-y-3"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">
            组织预设 ({{ orgPresetCards.length }})
          </h3>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div
            v-for="item in orgPresetCards"
            :key="`${item.kind}-${item.id}`"
            class="rounded-lg border border-gray-200 dark:border-gray-700 p-3 min-h-[180px] flex flex-col justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div class="space-y-2 min-w-0">
              <div class="flex items-center gap-2">
                <UIcon
                  :name="item.kind === 'group' ? 'i-lucide-folder' : 'i-lucide-pin'"
                  :class="item.kind === 'group' ? 'text-blue-500' : 'text-primary-500'"
                  class="w-4 h-4 flex-shrink-0"
                />
                <span class="font-medium truncate">{{ item.name }}</span>
                <UBadge
                  :color="item.kind === 'group' ? 'info' : 'success'"
                  variant="subtle"
                  size="xs"
                >
                  {{ item.kind === "group" ? "组预设" : "预设" }}
                </UBadge>
              </div>

              <div class="text-xs text-gray-500 flex items-center gap-2">
                <span class="font-mono">{{ item.kind === "group" ? item.default_branch : item.branch }}</span>
                <span class="text-gray-300">·</span>
                <span class="truncate">{{ item.workflow_path }}</span>
              </div>

              <div class="text-xs text-gray-400">
                {{ item.kind === "group" ? "组织公开预设组" : "组织公开预设" }}
              </div>

              <div
                v-if="item.creator"
                class="text-xs text-gray-400"
              >
                by @{{ item.creator.username }}
              </div>
            </div>

            <div class="flex items-center gap-2 mt-3">
              <UButton
                icon="i-lucide-link"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="item.kind === 'group' ? copyGroupUrl(item) : copyPresetUrl(item)"
              />
              <NuxtLink
                :to="item.kind === 'group' ? `/workflow-groups/${item.share_token}` : `/workflows/${item.share_token}`"
                target="_blank"
              >
                <UButton
                  icon="i-lucide-external-link"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                />
              </NuxtLink>
              <UButton
                v-if="item.kind === 'group' ? canManageGroup(item) : canManagePreset(item)"
                :icon="item.is_public ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                :color="item.is_public ? 'warning' : 'success'"
                variant="ghost"
                size="sm"
                @click="item.kind === 'group' ? toggleGroupPublic(item) : togglePresetPublic(item)"
              />
              <UButton
                v-if="item.kind === 'group' ? canManageGroup(item) : canManagePreset(item)"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="sm"
                @click="item.kind === 'group' ? deleteGroup(item) : deletePreset(item)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 我的预设 -->
      <div
        v-if="myPresets.length > 0"
        class="space-y-3"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">
            我的预设 ({{ myPresets.length }})
          </h3>
        </div>
        <div class="space-y-2">
          <div
            v-for="preset in myPresets"
            :key="preset.id"
            class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <UIcon
                  :name="preset.is_public ? 'i-lucide-pin' : 'i-lucide-lock'"
                  :class="preset.is_public ? 'text-primary-500' : 'text-gray-400'"
                  class="w-4 h-4 flex-shrink-0"
                />
                <span class="font-medium truncate">{{ preset.name }}</span>
                <UBadge
                  :color="preset.is_public ? 'success' : 'neutral'"
                  variant="subtle"
                  size="xs"
                >
                  {{ preset.is_public ? '公开' : '私有' }}
                </UBadge>
              </div>
              <div class="text-xs text-gray-500 mt-1 flex items-center gap-2">
                <span class="font-mono">{{ preset.branch }}</span>
                <span class="text-gray-300">·</span>
                <span class="truncate">{{ preset.workflow_path }}</span>
              </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0 ml-4">
              <UButton
                icon="i-lucide-link"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="copyPresetUrl(preset)"
              />
              <NuxtLink
                :to="`/workflows/${preset.share_token}`"
                target="_blank"
              >
                <UButton
                  icon="i-lucide-external-link"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                />
              </NuxtLink>
              <UButton
                :icon="preset.is_public ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                :color="preset.is_public ? 'warning' : 'success'"
                variant="ghost"
                size="sm"
                @click="togglePresetPublic(preset)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="sm"
                @click="deletePreset(preset)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 预设组 -->
      <div
        v-if="myPrivatePresetGroups.length > 0"
        class="space-y-3"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">
            我的预设组 ({{ myPrivatePresetGroups.length }})
          </h3>
        </div>
        <div class="space-y-2">
          <div
            v-for="group in myPrivatePresetGroups"
            :key="group.id"
            class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <UIcon
                  name="i-lucide-folder"
                  class="w-4 h-4 text-primary-500 flex-shrink-0"
                />
                <span class="font-medium truncate">{{ group.name }}</span>
                <UBadge
                  :color="group.is_public ? 'success' : 'neutral'"
                  variant="subtle"
                  size="xs"
                >
                  {{ group.is_public ? '公开' : '私有' }}
                </UBadge>
              </div>
              <div class="text-xs text-gray-500 mt-1 flex items-center gap-2">
                <span class="font-mono">{{ group.default_branch }}</span>
                <span class="text-gray-300">·</span>
                <span class="truncate">{{ group.workflow_path }}</span>
              </div>
              <div
                v-if="group.creator"
                class="text-xs text-gray-400 mt-1"
              >
                by @{{ group.creator.username }}
              </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0 ml-4">
              <UButton
                icon="i-lucide-link"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="copyGroupUrl(group)"
              />
              <NuxtLink
                :to="`/workflow-groups/${group.share_token}`"
                target="_blank"
              >
                <UButton
                  icon="i-lucide-external-link"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                />
              </NuxtLink>
              <UButton
                v-if="canManageGroup(group)"
                :icon="group.is_public ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                :color="group.is_public ? 'warning' : 'success'"
                variant="ghost"
                size="sm"
                @click="toggleGroupPublic(group)"
              />
              <UButton
                v-if="canManageGroup(group)"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="sm"
                @click="deleteGroup(group)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 全部为空时的提示 -->
      <div
        v-if="orgPresetCards.length === 0 && myPresets.length === 0 && myPrivatePresetGroups.length === 0"
        class="text-center py-12"
      >
        <UIcon
          name="i-lucide-bookmark"
          class="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4"
        />
        <p class="text-gray-400">
          暂无预设
        </p>
        <p class="text-sm text-gray-400 mt-1">
          在 Actions 页面触发工作流后可保存为预设
        </p>
      </div>
    </template>
  </div>
</template>
