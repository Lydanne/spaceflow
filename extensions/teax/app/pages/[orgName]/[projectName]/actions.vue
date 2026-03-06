<script setup lang="ts">
const props = defineProps<{
  orgId: string;
  projectId: string;
}>();
</script>

<template>
  <ClientOnly>
    <ProjectActionsTab
      :org-id="props.orgId"
      :project-id="props.projectId"
    />
    <template #fallback>
      <ProjectActionsSkeleton />
    </template>
  </ClientOnly>
</template>
