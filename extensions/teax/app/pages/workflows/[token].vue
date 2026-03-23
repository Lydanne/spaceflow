<script setup lang="ts">
definePageMeta({
  layout: "default",
});

interface WorkflowInputDef {
  description?: string;
  required?: boolean;
  default?: string;
  type?: string;
  options?: string[];
}

interface PresetData {
  preset: {
    id: string;
    name: string;
    workflow_path: string;
    workflow_name: string;
    branch: string;
    inputs: Record<string, string>;
    allow_input_override: boolean;
    allow_branch_override: boolean;
  };
  inputDefs: Record<string, WorkflowInputDef>;
  branches: string[];
  repository: {
    id: string;
    full_name: string;
    name: string;
  };
}

const token = computed(() => useRoute().params.token as string);
const { handlePermissionError } = useScenePermission();

// 获取预设信息
const { data: presetData, error: presetError, status: presetStatus } = useLazyFetch<PresetData>(
  () => `/api/workflow-presets/${token.value}`,
);

// 权限不足时自动跳转到申请页面
watch(presetError, (err) => {
  handlePermissionError(err);
}, { immediate: true });

// API URLs
const statusUrl = computed(() => `/api/workflow-presets/${token.value}/status`);
const runUrl = computed(() => `/api/workflow-presets/${token.value}/run`);
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- 加载中 -->
    <div
      v-if="presetStatus === 'pending'"
      class="flex items-center justify-center min-h-screen"
    >
      <UIcon
        name="i-lucide-loader"
        class="w-8 h-8 animate-spin text-primary-500"
      />
    </div>

    <!-- 错误 -->
    <div
      v-else-if="presetError"
      class="flex flex-col items-center justify-center min-h-screen gap-4"
    >
      <UIcon
        name="i-lucide-alert-circle"
        class="w-16 h-16 text-red-500"
      />
      <p class="text-lg text-gray-600 dark:text-gray-400">
        {{ (presetError as { data?: { message?: string } })?.data?.message || "无法加载预设" }}
      </p>
      <UButton
        to="/"
        color="primary"
        variant="soft"
      >
        返回首页
      </UButton>
    </div>

    <!-- 主内容 -->
    <WorkflowRunner
      v-else-if="presetData"
      :data="presetData"
      :status-url="statusUrl"
      :run-url="runUrl"
    />
  </div>
</template>
