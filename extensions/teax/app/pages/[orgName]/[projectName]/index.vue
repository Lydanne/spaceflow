<script setup lang="ts">
const props = defineProps<{
  orgName: string;
  projectId: string;
}>();
</script>

<template>
  <ProjectReadmeTab
    :org-name="props.orgName"
    :project-id="props.projectId"
  />
</template>
