<script setup lang="ts">
const props = defineProps<{
  owner: string;
  repo: string;
}>();
</script>

<template>
  <ProjectReadmeTab
    :owner="props.owner"
    :repo="props.repo"
  />
</template>
