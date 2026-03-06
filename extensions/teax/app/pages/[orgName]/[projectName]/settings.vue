<script setup lang="ts">
const props = defineProps<{
  owner: string;
  repo: string;
  project: {
    id: string;
    full_name: string;
    default_branch: string | null;
    clone_url: string;
    webhook_id: number | null;
    settings: Record<string, unknown>;
  };
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
