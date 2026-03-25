<script setup lang="ts">
interface WorkflowInputDef {
  description?: string;
  required?: boolean;
  default?: string;
  type?: string;
  options?: string[];
}

interface BranchOption {
  label: string;
  value: string;
}

const props = withDefaults(
  defineProps<{
    name: string;
    branch: string;
    inputs: Record<string, string>;
    inputDefs: Record<string, WorkflowInputDef>;
    branchOptions?: BranchOption[];
    workflowName?: string;
    showOverrideOptions?: boolean;
    lockedInputs?: string[];
    allowBranchOverride?: boolean;
    allowSyncOverride?: boolean;
    showPreview?: boolean;
    namePlaceholder?: string;
    branchPlaceholder?: string;
    showPublicOption?: boolean;
    isPublic?: boolean;
  }>(),
  {
    branchOptions: () => [],
    workflowName: "",
    showOverrideOptions: false,
    lockedInputs: () => [],
    allowBranchOverride: false,
    allowSyncOverride: false,
    showPreview: false,
    namePlaceholder: "预设名称",
    branchPlaceholder: "分支",
    showPublicOption: false,
    isPublic: false,
  },
);

const emit = defineEmits<{
  "update:name": [value: string];
  "update:branch": [value: string];
  "update:inputs": [value: Record<string, string>];
  "update:lockedInputs": [value: string[]];
  "update:allowBranchOverride": [value: boolean];
  "update:allowSyncOverride": [value: boolean];
  "update:isPublic": [value: boolean];
}>();

const localName = computed({
  get: () => props.name,
  set: (val) => emit("update:name", val),
});

const localBranch = computed({
  get: () => props.branch,
  set: (val) => emit("update:branch", val),
});

const localAllowBranchOverride = computed({
  get: () => props.allowBranchOverride,
  set: (val) => emit("update:allowBranchOverride", val),
});

const localAllowSyncOverride = computed({
  get: () => props.allowSyncOverride,
  set: (val) => emit("update:allowSyncOverride", val),
});

const localIsPublic = computed({
  get: () => props.isPublic,
  set: (val) => emit("update:isPublic", val),
});

function updateInputs(newInputs: Record<string, string>) {
  emit("update:inputs", newInputs);
}

function isInputLocked(key: string): boolean {
  return props.lockedInputs.includes(key);
}

function toggleInputLock(key: string) {
  const newLockedInputs = isInputLocked(key)
    ? props.lockedInputs.filter((k) => k !== key)
    : [...props.lockedInputs, key];
  emit("update:lockedInputs", newLockedInputs);
}

const hasInputs = computed(() => Object.keys(props.inputDefs).length > 0);
</script>

<template>
  <div class="space-y-4">
    <!-- 名称 -->
    <div>
      <label class="block text-sm font-medium mb-1">名称 *</label>
      <UInput
        v-model="localName"
        :placeholder="namePlaceholder"
        class="w-full"
      />
    </div>

    <!-- 分支 -->
    <div>
      <label class="block text-sm font-medium mb-1">分支</label>
      <USelect
        v-if="branchOptions.length > 0"
        v-model="localBranch"
        :items="branchOptions"
        value-key="value"
        class="w-full"
        :placeholder="branchPlaceholder"
      />
      <UInput
        v-else
        v-model="localBranch"
        :placeholder="branchPlaceholder"
        class="w-full"
      />
    </div>

    <!-- Workflow Inputs -->
    <template v-if="hasInputs">
      <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
        <p class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
          工作流参数
          <span
            v-if="showOverrideOptions"
            class="text-xs text-gray-400 font-normal ml-2"
          >点击锁图标控制用户是否可修改</span>
        </p>
        <WorkflowInputsForm
          :input-defs="inputDefs"
          :model-value="inputs"
          :locked-inputs="lockedInputs"
          :show-lock-button="showOverrideOptions"
          @update:model-value="updateInputs"
          @update:locked-inputs="emit('update:lockedInputs', $event)"
        />
      </div>
    </template>

    <!-- 公开到组织选项 -->
    <template v-if="showPublicOption">
      <div class="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
        <div>
          <label class="text-sm font-medium">公开到组织</label>
          <p class="text-xs text-gray-400">
            开启后，组织内所有成员都可以使用此预设
          </p>
        </div>
        <USwitch v-model="localIsPublic" />
      </div>
    </template>

    <!-- 分支修改权限开关（可选） -->
    <template v-if="showOverrideOptions">
      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium">允许用户修改分支</label>
          <p class="text-xs text-gray-400">
            开启后，使用分享链接的用户可以选择其他分支运行
          </p>
        </div>
        <USwitch v-model="localAllowBranchOverride" />
      </div>
      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-medium">允许同步用户修改</label>
          <p class="text-xs text-gray-400">
            开启后，用户修改的分支和参数会同步保存到数据库
          </p>
        </div>
        <USwitch v-model="localAllowSyncOverride" />
      </div>
    </template>

    <!-- 配置预览（可选） -->
    <template v-if="showPreview">
      <div class="rounded-lg bg-gray-50 dark:bg-gray-800 p-4 space-y-2 text-sm">
        <div
          v-if="workflowName"
          class="flex justify-between"
        >
          <span class="text-gray-500">Workflow</span>
          <span class="font-medium">{{ workflowName }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">分支</span>
          <span class="font-mono">{{ branch }}</span>
        </div>
        <template v-if="Object.keys(inputs).length > 0">
          <div
            v-for="(value, key) in inputs"
            :key="key"
            class="flex justify-between"
          >
            <span class="text-gray-500">{{ key }}</span>
            <span class="font-mono">{{ value || '-' }}</span>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>
