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

interface WorkflowData {
  workflow: {
    name: string;
    path: string;
  };
  inputDefs: Record<string, WorkflowInputDef>;
  branches: string[];
  repository: {
    id: string;
    full_name: string;
    name: string;
  };
}

const route = useRoute();

const owner = computed(() => route.params.owner as string);
const repo = computed(() => route.params.repo as string);
// Nuxt 会截断 .yml/.yaml 扩展名，从 route.fullPath 恢复完整文件名
const workflowFileName = computed(() => {
  const match = route.fullPath.match(/\/workflows\/(.+?)(?:\?|$)/);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
});
const defaultBranch = computed(() => (route.query.branch as string) || "main");

// 获取工作流详情
const {
  data: workflowData,
  error,
  status,
} = useLazyFetch<WorkflowData>(
  () => `/api/repos/${owner.value}/${repo.value}/workflows/${workflowFileName.value}`,
  {
    query: { branch: defaultBranch.value },
  },
);

// 将工作流数据转换为预设数据结构
const presetData = computed(() => {
  if (!workflowData.value) return null;
  const data = workflowData.value;
  // 从 inputDefs 中提取默认值，并用 URL query 参数覆盖
  const inputs: Record<string, string> = {};
  for (const [key, def] of Object.entries(data.inputDefs)) {
    // 优先使用 URL query 参数，否则使用默认值
    const queryValue = route.query[key];
    if (typeof queryValue === "string") {
      inputs[key] = queryValue;
    } else {
      inputs[key] = String(def.default ?? "");
    }
  }
  return {
    preset: {
      id: "",
      share_token: "",
      name: data.workflow.name,
      workflow_path: data.workflow.path,
      workflow_name: data.workflow.name,
      branch: defaultBranch.value,
      inputs,
      allow_input_override: true,
      locked_inputs: [], // 直接触发模式下所有参数都可修改
      allow_branch_override: true,
      allow_sync_override: false,
    },
    inputDefs: data.inputDefs,
    branches: data.branches,
    repository: data.repository,
  };
});

// 运行 URL（直接调用 actions API）
const runUrl = computed(() => `/api/repos/${owner.value}/${repo.value}/actions`);
// 运行详情 URL 前缀（用于轮询状态）
const runDetailUrlPrefix = computed(() => `/api/repos/${owner.value}/${repo.value}/actions/runs`);
</script>

<template>
  <div>
    <!-- 加载中 -->
    <div
      v-if="status === 'pending'"
      class="flex items-center justify-center py-12"
    >
      <UIcon
        name="i-lucide-loader"
        class="w-6 h-6 animate-spin text-gray-400"
      />
    </div>

    <!-- 错误 -->
    <div
      v-else-if="error"
      class="flex flex-col items-center justify-center py-12 gap-4"
    >
      <UIcon
        name="i-lucide-alert-circle"
        class="w-12 h-12 text-red-500"
      />
      <p class="text-gray-600 dark:text-gray-400">
        {{ (error as { data?: { message?: string } })?.data?.message || "无法加载工作流" }}
      </p>
      <UButton
        :to="`/${owner}/${repo}/actions`"
        color="primary"
        variant="soft"
        size="sm"
      >
        返回 Actions
      </UButton>
    </div>

    <!-- 主内容 -->
    <WorkflowRunner
      v-else-if="presetData"
      :data="presetData"
      :run-url="runUrl"
      :run-detail-url-prefix="runDetailUrlPrefix"
      direct-mode
      embedded
    />
  </div>
</template>
