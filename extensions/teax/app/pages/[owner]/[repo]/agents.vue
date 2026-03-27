<script setup lang="ts">
defineProps<{
  owner: string;
  repo: string;
}>();
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-lg font-semibold">
          Agents
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          管理项目的开发环境，支持 Web VSCode 和 OpenCode AI 编辑
        </p>
      </div>
      <UButton
        icon="i-lucide-plus"
        color="primary"
      >
        创建Agents
      </UButton>
    </div>

    <!-- Agents列表占位 -->
    <div class="text-center py-12 text-gray-400">
      <UIcon
        name="i-lucide-container"
        class="w-12 h-12 mx-auto mb-3"
      />
      <p>Agents功能开发中</p>
      <p class="text-sm mt-2">
        每个项目将自动创建 CI Agent，用户也可以手动创建开发Agents
      </p>
    </div>
  </div>
</template>
