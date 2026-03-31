<script setup lang="ts">
import type { ProjectDetailDto } from "~~/server/shared/dto";

const props = defineProps<{
  owner: string;
  repo: string;
  project: ProjectDetailDto;
  isOwnerOrAdmin: boolean;
}>();
</script>

<template>
  <ProjectSettingsTab
    v-if="props.isOwnerOrAdmin"
    :owner="props.owner"
    :repo="props.repo"
    :project="props.project"
  />
  <div
    v-else
    class="text-center py-12 text-gray-400"
  >
    <UIcon
      name="i-lucide-lock"
      class="w-12 h-12 mx-auto mb-3"
    />
    <p>无权限访问设置页面</p>
  </div>
</template>
