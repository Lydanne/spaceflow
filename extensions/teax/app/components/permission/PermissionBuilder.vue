<template>
  <UCard>
    <template #header>
      <h3 class="text-lg font-semibold">
        权限构建器
      </h3>
    </template>

    <!-- 卡片式三段选择器 -->
    <div class="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
      <!-- 预览区域 -->
      <div class="flex items-center gap-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div class="flex items-center gap-1 text-sm font-mono flex-1">
          <span :class="selectedGroup ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'">
            {{ selectedGroup || "分组" }}
          </span>
          <span class="text-gray-400">:</span>
          <span :class="selectedAction ? 'text-green-600 dark:text-green-400' : 'text-gray-400'">
            {{ selectedAction || "操作" }}
          </span>
          <template v-if="patternType === 'pattern'">
            <span class="text-gray-400">:</span>
            <span :class="customPattern ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400'">
              {{ customPattern || "模式" }}
            </span>
          </template>
        </div>
      </div>

      <div class="border-t border-gray-200 dark:border-gray-800" />

      <!-- Step 1: 分组选择 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          📦 分组选择
        </label>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="group in groupOptions"
            :key="group.value"
            :variant="selectedGroup === group.value ? 'solid' : 'outline'"
            :color="selectedGroup === group.value ? 'primary' : 'neutral'"
            size="sm"
            @click="selectGroup(group.value)"
          >
            {{ group.label }}
          </UButton>
        </div>
      </div>

      <!-- Step 2: 操作选择 -->
      <div v-if="selectedGroup">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          🎯 操作选择 ({{ groupOptions.find(g => g.value === selectedGroup)?.label }})
        </label>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="action in actionOptions"
            :key="action.value"
            :variant="selectedAction === action.value ? 'solid' : 'outline'"
            :color="selectedAction === action.value ? 'primary' : 'neutral'"
            size="sm"
            @click="selectAction(action.value)"
          >
            {{ action.label }}
          </UButton>
        </div>
      </div>

      <!-- Step 3: 资源模式 -->
      <div v-if="selectedAction">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          🎨 资源模式
        </label>

        <UCard>
          <!-- 模式类型选择 -->
          <div class="mb-4">
            <div class="flex gap-2">
              <UButton
                :variant="patternType === 'all' ? 'solid' : 'outline'"
                :color="patternType === 'all' ? 'primary' : 'neutral'"
                size="sm"
                @click="patternType = 'all'"
              >
                所有资源 (*)
              </UButton>
              <UButton
                :variant="patternType === 'pattern' ? 'solid' : 'outline'"
                :color="patternType === 'pattern' ? 'primary' : 'neutral'"
                size="sm"
                @click="patternType = 'pattern'"
              >
                使用模式匹配
              </UButton>
            </div>
          </div>

          <!-- 模式配置面板 -->
          <div v-if="patternType === 'pattern'" class="space-y-4">
            <!-- 常用模板 -->
            <div v-if="patternTemplates.length > 0">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                🔍 快速选择
              </label>
              <div class="mt-2 flex flex-wrap gap-2">
                <UButton
                  v-for="template in patternTemplates"
                  :key="template.pattern"
                  size="sm"
                  variant="outline"
                  @click="applyTemplate(template)"
                >
                  {{ template.label }}
                </UButton>
              </div>
            </div>

            <!-- 自定义输入 -->
            <div>
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                自定义模式
              </label>
              <UInput
                v-model="customPattern"
                placeholder="例如: test-*, deploy-{dev,staging}"
                class="mt-2"
              />
              <p class="mt-1 text-xs text-gray-500">
                💡 支持 * ? [] {} 等 glob 语法
              </p>
            </div>

            <!-- 匹配示例 -->
            <div v-if="matchExamples.length > 0">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                ✅ 匹配示例
              </label>
              <ul class="mt-2 space-y-1">
                <li
                  v-for="example in matchExamples"
                  :key="example.name"
                  class="text-sm flex items-center gap-2"
                >
                  <UIcon
                    :name="example.matches ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'"
                    :class="example.matches ? 'text-green-500' : 'text-red-500'"
                  />
                  <code class="text-xs">{{ example.name }}</code>
                </li>
              </ul>
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton
          variant="ghost"
          @click="reset"
        >
          重置
        </UButton>
        <UButton
          color="primary"
          :disabled="!permissionPreview"
          @click="addPermission"
        >
          添加权限
        </UButton>
      </div>
    </template>
  </UCard>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

const emit = defineEmits<{
  add: [permission: string];
}>();

// 简单的 glob 匹配函数（仅用于 UI 预览）
function simpleGlobMatch(str: string, pattern: string): boolean {
  // 将 glob 模式转换为正则表达式
  const regexPattern = pattern
    .replace(/\./g, "\\.")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".")
    .replace(/\{([^}]+)\}/g, (_, group) => `(${group.replace(/,/g, "|")})`);

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(str);
}

// 分组配置
const groupOptions = [
  { value: "repo", label: "仓库" },
  { value: "actions", label: "Actions" },
  { value: "agent", label: "Agent" },
  { value: "page", label: "Pages" },
  { value: "miniapp", label: "小程序" },
  { value: "team", label: "团队" },
  { value: "settings", label: "设置" },
];

// 操作配置（根据分组动态变化）
const actionMap: Record<string, Array<{ value: string; label: string }>> = {
  repo: [
    { value: "view", label: "查看" },
    { value: "create", label: "创建" },
    { value: "delete", label: "删除" },
    { value: "settings", label: "设置" },
  ],
  actions: [
    { value: "view", label: "查看" },
    { value: "trigger", label: "触发 Workflow" },
  ],
  agent: [
    { value: "start", label: "启动" },
    { value: "stop", label: "停止" },
  ],
  page: [
    { value: "deploy", label: "部署" },
  ],
  miniapp: [
    { value: "manage", label: "管理" },
  ],
  team: [
    { value: "manage", label: "管理" },
  ],
  settings: [
    { value: "manage", label: "管理" },
  ],
};

// 模式模板（根据分组+操作动态变化）
const templateMap: Record<string, Array<{ pattern: string; label: string }>> = {
  "actions:trigger": [
    { pattern: "test-*", label: "测试 (test-*)" },
    { pattern: "publish-*", label: "发布 (publish-*)" },
    { pattern: "deploy-*-staging", label: "Staging 部署" },
    { pattern: "deploy-*-production", label: "Production 部署" },
  ],
  "actions:view": [
    { pattern: "test-*", label: "测试 (test-*)" },
    { pattern: "deploy-*", label: "部署 (deploy-*)" },
  ],
  "agent:start": [
    { pattern: "dev-*", label: "开发环境 (dev-*)" },
    { pattern: "prod-*", label: "生产环境 (prod-*)" },
  ],
  "agent:stop": [
    { pattern: "dev-*", label: "开发环境 (dev-*)" },
    { pattern: "prod-*", label: "生产环境 (prod-*)" },
  ],
  "page:deploy": [
    { pattern: "staging", label: "Staging" },
    { pattern: "production", label: "Production" },
  ],
};

// 匹配示例（根据分组+操作动态变化）
const exampleMap: Record<string, string[]> = {
  "actions:trigger": [
    "test-unit",
    "test-integration",
    "test-e2e",
    "publish-npm",
    "publish-docker",
    "deploy-api-staging",
    "deploy-web-production",
  ],
  "actions:view": [
    "test-unit",
    "test-integration",
    "deploy-api-staging",
    "deploy-web-production",
  ],
  "agent:start": ["dev-api", "dev-web", "prod-api", "prod-web"],
  "agent:stop": ["dev-api", "dev-web", "prod-api", "prod-web"],
  "page:deploy": ["staging", "production"],
};

const selectedGroup = ref("");
const selectedAction = ref("");
const patternType = ref<"all" | "pattern">("all");
const customPattern = ref("");

const actionOptions = computed(() => {
  return selectedGroup.value ? actionMap[selectedGroup.value] || [] : [];
});

const patternTemplates = computed(() => {
  const key = `${selectedGroup.value}:${selectedAction.value}`;
  return templateMap[key] || [];
});

const permissionPreview = computed(() => {
  if (!selectedGroup.value || !selectedAction.value) return "";

  const base = `${selectedGroup.value}:${selectedAction.value}`;

  if (patternType.value === "all") {
    return base; // 向后兼容，不加 :*
  }

  const pattern = customPattern.value || "*";
  return `${base}:${pattern}`;
});

const matchExamples = computed(() => {
  if (patternType.value === "all" || !customPattern.value) return [];

  const key = `${selectedGroup.value}:${selectedAction.value}`;
  const examples = exampleMap[key] || [];

  return examples.map((name) => ({
    name,
    matches: simpleGlobMatch(name, customPattern.value),
  }));
});

function selectGroup(group: string) {
  selectedGroup.value = group;
}

function selectAction(action: string) {
  selectedAction.value = action;
}

function applyTemplate(template: { pattern: string; label: string }) {
  customPattern.value = template.pattern;
}

function reset() {
  selectedGroup.value = "";
  selectedAction.value = "";
  patternType.value = "all";
  customPattern.value = "";
}

function addPermission() {
  if (permissionPreview.value) {
    emit("add", permissionPreview.value);
    reset();
  }
}

// 切换分组时重置操作
watch(selectedGroup, () => {
  selectedAction.value = "";
  customPattern.value = "";
  patternType.value = "all";
});

// 切换操作时重置模式
watch(selectedAction, () => {
  customPattern.value = "";
  patternType.value = "all";
});
</script>
