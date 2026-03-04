<script setup lang="ts">
const { user } = useUserSession()
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold mb-6">
      欢迎回来, {{ user?.username }}
    </h1>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <UCard>
        <div class="text-center">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            项目总数
          </p>
          <p class="text-3xl font-bold mt-1">
            0
          </p>
        </div>
      </UCard>
      <UCard>
        <div class="text-center">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            运行中任务
          </p>
          <p class="text-3xl font-bold mt-1">
            0
          </p>
        </div>
      </UCard>
      <UCard>
        <div class="text-center">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            今日发布
          </p>
          <p class="text-3xl font-bold mt-1">
            0
          </p>
        </div>
      </UCard>
    </div>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">
            最近项目
          </h2>
        </div>
      </template>

      <div class="text-center py-8 text-gray-400">
        <UIcon
          name="i-lucide-folder-open"
          class="w-12 h-12 mx-auto mb-3"
        />
        <p>暂无项目</p>
        <p class="text-sm mt-1">
          创建项目后将在此展示
        </p>
      </div>
    </UCard>
  </div>
</template>
