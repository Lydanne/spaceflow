<script setup lang="ts">
import type { PresetItem } from "~/components/preset/PresetCard.vue";
import type { PresetGroupItem } from "~/components/preset/PresetGroupCard.vue";

const route = useRoute();
const owner = route.params.owner as string;
const repo = route.params.repo as string;

interface RepoPresetItem {
  id: string;
  name: string;
  workflow_path: string;
  branch: string;
  share_token: string;
  is_public: boolean;
  created_by?: string;
  creator?: {
    name: string | null;
    username: string;
    avatar_url: string | null;
  } | null;
  created_at: string;
}

interface RepoPresetGroupItem {
  id: string;
  name: string;
  description?: string | null;
  workflow_path: string;
  default_branch: string;
  share_token: string;
  is_public: boolean;
  created_by?: string;
  creator?: {
    name: string | null;
    username: string;
    avatar_url: string | null;
  } | null;
  created_at: string;
}

const { data, pending, refresh } = await useFetch<{
  org_presets: RepoPresetItem[];
  my_presets: RepoPresetItem[];
  preset_groups: RepoPresetGroupItem[];
}>(`/api/repos/${owner}/${repo}/presets`);

const orgPresets = computed(() => data.value?.org_presets ?? []);
const myPresets = computed(() => data.value?.my_presets ?? []);
const presetGroups = computed(() => data.value?.preset_groups ?? []);

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
async function togglePresetPublic(preset: RepoPresetItem) {
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

async function toggleGroupPublic(group: RepoPresetGroupItem) {
  try {
    await $fetch(`/api/workflow-preset-groups/${group.id}`, {
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

// 删除预设
async function deletePreset(preset: RepoPresetItem) {
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
        v-if="orgPresets.length > 0"
        class="space-y-3"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">
            组织预设 ({{ orgPresets.length }})
          </h3>
        </div>
        <div class="space-y-2">
          <div
            v-for="preset in orgPresets"
            :key="preset.id"
            class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <UIcon
                  name="i-lucide-pin"
                  class="w-4 h-4 text-primary-500 flex-shrink-0"
                />
                <span class="font-medium truncate">{{ preset.name }}</span>
                <UBadge
                  color="success"
                  variant="subtle"
                  size="xs"
                >
                  公开
                </UBadge>
              </div>
              <div class="text-xs text-gray-500 mt-1 flex items-center gap-2">
                <span class="font-mono">{{ preset.branch }}</span>
                <span class="text-gray-300">·</span>
                <span class="truncate">{{ preset.workflow_path }}</span>
              </div>
              <div
                v-if="preset.creator"
                class="text-xs text-gray-400 mt-1"
              >
                by @{{ preset.creator.username }}
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
        v-if="presetGroups.length > 0"
        class="space-y-3"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">
            预设组 ({{ presetGroups.length }})
          </h3>
        </div>
        <div class="space-y-2">
          <div
            v-for="group in presetGroups"
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
            </div>
          </div>
        </div>
      </div>

      <!-- 全部为空时的提示 -->
      <div
        v-if="orgPresets.length === 0 && myPresets.length === 0 && presetGroups.length === 0"
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
