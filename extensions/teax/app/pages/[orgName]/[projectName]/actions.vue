<script setup lang="ts">
const props = defineProps<{
  owner: string;
  repo: string;
}>();
</script>

<template>
  <ClientOnly>
    <ProjectActionsTab
      :owner="props.owner"
      :repo="props.repo"
    />
    <template #fallback>
      <ProjectActionsSkeleton />
    </template>
  </ClientOnly>
</template>
