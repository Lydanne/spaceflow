<script setup lang="ts">
const props = defineProps<{
  orgId: string;
  projectId: string;
  project: {
    id: string;
    fullName: string;
    defaultBranch: string | null;
    cloneUrl: string;
    webhookId: number | null;
    settings: Record<string, unknown>;
  };
  isOwnerOrAdmin: boolean;
}>();
</script>

<template>
  <ProjectSettingsTab
    v-if="props.isOwnerOrAdmin"
    :org-id="props.orgId"
    :project-id="props.projectId"
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
