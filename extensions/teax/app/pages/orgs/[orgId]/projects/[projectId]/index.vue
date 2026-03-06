<script setup lang="ts">
const props = defineProps<{
  orgId: string;
  projectId: string;
}>();
</script>

<template>
  <ProjectReadmeTab
    :org-id="props.orgId"
    :project-id="props.projectId"
  />
</template>
