<script setup lang="ts">
import type { PresetItem } from "~/components/preset/PresetCard.vue";
import type { PresetGroupItem } from "~/components/preset/PresetGroupCard.vue";

const orgName = inject<string>("orgName")!;
const isOwnerOrAdmin = inject<ComputedRef<boolean>>("isOwnerOrAdmin")!;

// 预设
const { data: presetsData, pending: presetsPending, refresh: refreshPresets } = await useFetch<{ data: PresetItem[] }>(
  `/api/orgs/${orgName}/presets`,
);
const presets = computed(() => presetsData.value?.data ?? []);

// 预设组
const { data: groupsData, pending: groupsPending, refresh: refreshGroups } = await useFetch<{ data: PresetGroupItem[] }>(
  `/api/orgs/${orgName}/preset-groups`,
);
const groups = computed(() => groupsData.value?.data ?? []);

const pending = computed(() => presetsPending.value || groupsPending.value);

async function refresh() {
  await Promise.all([refreshPresets(), refreshGroups()]);
}

const toast = useToast();

async function togglePresetPublic(preset: PresetItem) {
  try {
    await $fetch(`/api/orgs/${orgName}/presets/${preset.id}`, {
      method: "PATCH",
      body: { is_public: !preset.is_public },
    });
    toast.add({
      title: preset.is_public ? "已设为私有" : "已设为公开",
      color: "success",
    });
    await refreshPresets();
  } catch {
    toast.add({ title: "操作失败", color: "error" });
  }
}

async function toggleGroupPublic(group: PresetGroupItem) {
  try {
    await $fetch(`/api/orgs/${orgName}/preset-groups/${group.id}`, {
      method: "PATCH",
      body: { is_public: !group.is_public },
    });
    toast.add({
      title: group.is_public ? "已设为私有" : "已设为公开",
      color: "success",
    });
    await refreshGroups();
  } catch {
    toast.add({ title: "操作失败", color: "error" });
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold">
        预设管理
      </h2>
      <UButton
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="ghost"
        size="sm"
        :loading="pending"
        @click="refresh"
      />
    </div>

    <p class="text-sm text-gray-500 dark:text-gray-400">
      管理组织内公开的工作流预设和预设组。公开后对所有组织成员可见。
    </p>

    <!-- 预设组部分 -->
    <div class="space-y-3">
      <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">
        预设组 ({{ groups.length }})
      </h3>

      <div
        v-if="pending"
        class="flex justify-center py-4"
      >
        <UIcon
          name="i-lucide-loader-2"
          class="w-5 h-5 animate-spin"
        />
      </div>

      <div
        v-else-if="groups.length === 0"
        class="text-center py-4 text-gray-500 text-sm"
      >
        暂无预设组
      </div>

      <div
        v-else
        class="space-y-3"
      >
        <PresetGroupCard
          v-for="group in groups"
          :key="group.id"
          :group="group"
          mode="org"
          :show-public-toggle="isOwnerOrAdmin"
          :show-creator="true"
          :expandable="false"
          @toggle-public="toggleGroupPublic"
        />
      </div>
    </div>

    <!-- 独立预设部分 -->
    <div class="space-y-3">
      <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">
        独立预设 ({{ presets.length }})
      </h3>

      <div
        v-if="pending"
        class="flex justify-center py-4"
      >
        <UIcon
          name="i-lucide-loader-2"
          class="w-5 h-5 animate-spin"
        />
      </div>

      <div
        v-else-if="presets.length === 0"
        class="text-center py-4 text-gray-500 text-sm"
      >
        暂无独立预设
      </div>

      <div
        v-else
        class="space-y-3"
      >
        <PresetCard
          v-for="preset in presets"
          :key="preset.id"
          :preset="preset"
          mode="org"
          :show-public-toggle="isOwnerOrAdmin"
          :show-creator="true"
          @toggle-public="togglePresetPublic"
        />
      </div>
    </div>
  </div>
</template>
