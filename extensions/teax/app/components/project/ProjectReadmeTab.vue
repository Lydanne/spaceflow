<script setup lang="ts">
const props = defineProps<{
  orgId: string;
  projectId: string;
}>();

const { data, status } = await useFetch<{ content: string | null; source: string | null }>(
  `/api/orgs/${props.orgId}/projects/${props.projectId}/readme`,
);
</script>

<template>
  <div>
    <div
      v-if="status === 'pending'"
      class="flex justify-center py-12"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-6 h-6 animate-spin text-gray-400"
      />
    </div>

    <template v-else-if="data?.content">
      <div class="flex items-center gap-2 mb-4 text-sm text-gray-500 dark:text-gray-400">
        <UIcon
          name="i-lucide-file-text"
          class="w-4 h-4"
        />
        <span>{{ data.source }}</span>
      </div>
      <UCard>
        <div class="prose prose-sm dark:prose-invert max-w-none">
          <MDC :value="data.content" tag="article" />
        </div>
      </UCard>
    </template>

    <div
      v-else
      class="text-center py-12 text-gray-400"
    >
      <UIcon
        name="i-lucide-file-text"
        class="w-12 h-12 mx-auto mb-3"
      />
      <p>未找到 README.md 或 TEAX.md</p>
      <p class="text-sm mt-1">
        在仓库根目录创建 TEAX.md 或 README.md 即可显示
      </p>
    </div>
  </div>
</template>
