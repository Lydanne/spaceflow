<script setup lang="ts">
const props = defineProps<{
  orgName: string;
  projectId: string;
}>();
</script>

<template>
  <ClientOnly>
    <ProjectActionsTab
      :org-name="props.orgName"
      :project-id="props.projectId"
    />
    <template #fallback>
      <ProjectActionsSkeleton />
    </template>
  </ClientOnly>
</template>
