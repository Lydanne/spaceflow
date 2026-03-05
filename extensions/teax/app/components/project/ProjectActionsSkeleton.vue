<template>
  <div
    class="animate-pulse"
    style="display: flex; gap: 1.5rem"
  >
    <!-- 左侧：Workflow 侧边栏骨架 -->
    <div style="width: 14rem; flex-shrink: 0">
      <div class="h-3 bg-gray-200 dark:bg-gray-800 rounded w-20 mb-3" />
      <div class="space-y-1">
        <div
          v-for="i in 4"
          :key="i"
          class="flex items-center gap-2 px-3 py-2"
        >
          <div class="w-4 h-4 bg-gray-200 dark:bg-gray-800 rounded" />
          <div
            class="h-3.5 bg-gray-200 dark:bg-gray-800 rounded"
            :style="{ width: `${50 + i * 15}px` }"
          />
        </div>
      </div>
    </div>

    <!-- 右侧：Run 列表骨架 -->
    <div class="flex-1 min-w-0">
      <!-- 顶部操作栏 -->
      <div class="flex items-center justify-between mb-4">
        <div class="h-4 bg-gray-200 dark:bg-gray-800 rounded w-32" />
        <div class="h-8 bg-gray-200 dark:bg-gray-800 rounded w-28" />
      </div>

      <!-- Run 列表 -->
      <div class="space-y-3">
        <div
          v-for="i in 5"
          :key="i"
          class="border border-gray-200 dark:border-gray-800 rounded-lg p-4"
        >
          <div class="flex items-start gap-3">
            <div class="w-5 h-5 bg-gray-200 dark:bg-gray-800 rounded-full shrink-0" />
            <div class="flex-1 space-y-2">
              <div class="flex items-center gap-2">
                <div
                  class="h-4 bg-gray-200 dark:bg-gray-800 rounded"
                  :style="{ width: `${120 + i * 20}px` }"
                />
                <div class="h-4 bg-gray-200 dark:bg-gray-800 rounded w-10" />
                <div class="h-5 bg-gray-200 dark:bg-gray-800 rounded-full w-14" />
              </div>
              <div class="flex items-center gap-3">
                <div class="h-3 bg-gray-200 dark:bg-gray-800 rounded w-16" />
                <div class="h-3 bg-gray-200 dark:bg-gray-800 rounded w-14" />
                <div class="h-3 bg-gray-200 dark:bg-gray-800 rounded w-10" />
                <div class="h-3 bg-gray-200 dark:bg-gray-800 rounded w-20" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
