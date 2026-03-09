<template>
  <div class="inline-flex items-center gap-1 text-xs font-mono">
    <span class="text-blue-600 dark:text-blue-400">{{ parts.group }}</span>
    <span class="text-gray-400">:</span>
    <span class="text-green-600 dark:text-green-400">{{ parts.action }}</span>
    <template v-if="parts.pattern">
      <span class="text-gray-400">:</span>
      <span class="text-orange-600 dark:text-orange-400">{{ parts.pattern }}</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  permission: string;
}>();

const parts = computed(() => {
  const [group, action, pattern] = props.permission.split(":");
  return { group, action, pattern };
});
</script>
