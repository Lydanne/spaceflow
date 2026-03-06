<script setup lang="ts">
defineProps<{
  owner: string;
  repo: string;
}>();
</script>

<template>
  <div class="text-center py-12 text-gray-400">
    <UIcon
      name="i-lucide-bot-message-square"
      class="w-12 h-12 mx-auto mb-3"
    />
    <p>Agent 功能将在 Phase 3 实现</p>
  </div>
</template>
