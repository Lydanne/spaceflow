<script setup lang="ts">
definePageMeta({
  layout: "default",
});

const toast = useToast();

interface PresetUser {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface SubPreset {
  id: string;
  name: string;
  preset_index: number;
  branch: string;
  inputs: Record<string, string | boolean | number> | null;
  share_token: string;
  current_run_id: number | null;
  locked_by: string | null;
  locked_at: string | null;
  auto_unlock_at: string | null;
  locked_by_user: PresetUser | null;
  status: "idle" | "locked" | "running";
}

interface WorkflowInput {
  description?: string;
  required?: boolean;
  default?: string;
  type?: string;
  options?: string[];
}

interface PresetGroupData {
  id: string;
  name: string;
  description: string | null;
  workflow_path: string;
  default_branch: string;
  default_inputs: Record<string, string | boolean | number> | null;
  auto_unlock_minutes: number | null;
  share_token: string;
  created_by: string;
  created_at: string;
  repository: {
    id: string;
    name: string;
    full_name: string;
  };
  creator: PresetUser;
  presets: SubPreset[];
  workflow_inputs: Record<string, WorkflowInput>;
}

const route = useRoute();
const token = computed(() => route.params.token as string);
const { loggedIn, user } = useUserSession();

// 获取预设组信息
const { data: groupData, error: groupError, status: groupStatus, refresh } = useLazyFetch<PresetGroupData>(
  () => `/api/workflow-preset-groups/${token.value}`,
);

// 锁定状态
const lockingIndex = ref<number | null>(null);
const unlockingIndex = ref<number | null>(null);
const triggeringIndex = ref<number | null>(null);

// 添加子预设
const showAddPresetModal = ref(false);
const newPresetName = ref("");
const newPresetBranch = ref("");
const newPresetInputs = ref<Record<string, string>>({});
const newPresetLockedInputs = ref<string[]>([]);
const newPresetAllowBranchOverride = ref(false);
const newPresetAllowSyncOverride = ref(false);
const addingPreset = ref(false);

// 批量创建子预设
const showBatchCreateModal = ref(false);
const batchLoopMode = ref<"range" | "list">("range");
const batchRangeStart = ref(1);
const batchRangeEnd = ref(5);
const batchCustomList = ref(""); // 逗号分隔的名称列表
const batchNameTemplate = ref("子预设 {i}"); // 支持 {i} 和 {name} 占位符
const batchBranch = ref("");
const batchInputs = ref<Record<string, string>>({});
const batchLockedInputs = ref<string[]>([]);
const batchAllowBranchOverride = ref(false);
const batchAllowSyncOverride = ref(false);
const batchCreating = ref(false);
const batchProgress = ref(0);
const batchTotal = ref(0);

// 批量创建预览列表
const batchPreviewList = computed(() => {
  const list: Array<{ name: string; index: number | string }> = [];
  if (batchLoopMode.value === "range") {
    const start = Math.max(1, batchRangeStart.value);
    const end = Math.min(100, batchRangeEnd.value); // 限制最多100个
    for (let i = start; i <= end; i++) {
      const name = batchNameTemplate.value
        .replace(/\{i\}/g, String(i))
        .replace(/\{name\}/g, String(i));
      list.push({ name, index: i });
    }
  } else {
    const names = batchCustomList.value
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 100); // 限制最多100个
    names.forEach((n, idx) => {
      const name = batchNameTemplate.value
        .replace(/\{i\}/g, String(idx + 1))
        .replace(/\{name\}/g, n);
      list.push({ name, index: n });
    });
  }
  return list;
});

// 是否是创建者或管理员
const isCreator = computed(() => {
  return groupData.value?.created_by === user.value?.id;
});

const isAdmin = computed(() => {
  return user.value?.is_admin === true;
});

const canManagePresets = computed(() => {
  return isCreator.value || isAdmin.value;
});

// 删除子预设
const deletingIndex = ref<number | null>(null);

async function deletePreset(index: number) {
  if (!confirm("确定要删除这个子预设吗？")) return;
  deletingIndex.value = index;
  try {
    await $fetch(`/api/workflow-preset-groups/${token.value}/presets/${index}`, {
      method: "DELETE",
    });
    await refresh();
  } catch (err) {
    console.error("Failed to delete preset:", err);
    toast.add({ title: (err as { data?: { message?: string } })?.data?.message || "删除失败", color: "error" });
  } finally {
    deletingIndex.value = null;
  }
}

// 锁定子预设
async function lockPreset(index: number) {
  lockingIndex.value = index;
  try {
    await $fetch(`/api/workflow-preset-groups/${token.value}/presets/${index}/lock`, {
      method: "POST",
      body: {},
    });
    await refresh();
  } catch (err) {
    console.error("Failed to lock preset:", err);
    alert((err as { data?: { message?: string } })?.data?.message || "锁定失败");
  } finally {
    lockingIndex.value = null;
  }
}

// 解锁子预设
async function unlockPreset(index: number) {
  unlockingIndex.value = index;
  try {
    await $fetch(`/api/workflow-preset-groups/${token.value}/presets/${index}/unlock`, {
      method: "POST",
    });
    await refresh();
  } catch (err) {
    console.error("Failed to unlock preset:", err);
    alert((err as { data?: { message?: string } })?.data?.message || "解锁失败");
  } finally {
    unlockingIndex.value = null;
  }
}

// 触发 CI
async function triggerPreset(index: number) {
  triggeringIndex.value = index;
  try {
    await $fetch(`/api/workflow-preset-groups/${token.value}/presets/${index}/trigger`, {
      method: "POST",
    });
    await refresh();
    alert("工作流已触发");
  } catch (err) {
    console.error("Failed to trigger preset:", err);
    alert((err as { data?: { message?: string } })?.data?.message || "触发失败");
  } finally {
    triggeringIndex.value = null;
  }
}

// 判断当前用户是否是锁定者
function isLockedByMe(preset: SubPreset): boolean {
  return preset.locked_by === user.value?.id;
}

// 申请解锁
const requestingUnlockIndex = ref<number | null>(null);

async function requestUnlock(index: number) {
  requestingUnlockIndex.value = index;
  try {
    await $fetch(`/api/workflow-preset-groups/${token.value}/presets/${index}/request-unlock`, {
      method: "POST",
    });
    toast.add({ title: "已发送解锁申请", color: "success" });
  } catch (err) {
    console.error("Failed to request unlock:", err);
    toast.add({
      title: (err as { data?: { message?: string } })?.data?.message || "申请失败",
      color: "error",
    });
  } finally {
    requestingUnlockIndex.value = null;
  }
}

// 打开添加子预设模态框
function openAddPresetModal() {
  newPresetName.value = `子预设 ${(groupData.value?.presets.length || 0) + 1}`;
  newPresetBranch.value = groupData.value?.default_branch || "main";
  // 初始化 inputs
  const defaultInputs = groupData.value?.default_inputs || {};
  const inputDefs = groupData.value?.workflow_inputs || {};
  const initialInputs: Record<string, string> = {};
  for (const [key, def] of Object.entries(inputDefs)) {
    const val = (defaultInputs as Record<string, string | boolean | number>)[key] ?? def.default ?? "";
    initialInputs[key] = String(val);
  }
  newPresetInputs.value = initialInputs;
  newPresetLockedInputs.value = [];
  newPresetAllowBranchOverride.value = false;
  newPresetAllowSyncOverride.value = false;
  showAddPresetModal.value = true;
}

// 打开批量创建模态框
function openBatchCreateModal() {
  const existingCount = groupData.value?.presets.length || 0;
  batchLoopMode.value = "range";
  batchRangeStart.value = existingCount + 1;
  batchRangeEnd.value = existingCount + 5;
  batchCustomList.value = "";
  batchNameTemplate.value = "子预设 {i}";
  batchBranch.value = groupData.value?.default_branch || "main";
  // 初始化 inputs
  const defaultInputs = groupData.value?.default_inputs || {};
  const inputDefs = groupData.value?.workflow_inputs || {};
  const initialInputs: Record<string, string> = {};
  for (const [key, def] of Object.entries(inputDefs)) {
    const val = (defaultInputs as Record<string, string | boolean | number>)[key] ?? def.default ?? "";
    initialInputs[key] = String(val);
  }
  batchInputs.value = initialInputs;
  batchLockedInputs.value = [];
  batchAllowBranchOverride.value = false;
  batchAllowSyncOverride.value = false;
  batchProgress.value = 0;
  batchTotal.value = 0;
  showBatchCreateModal.value = true;
}

// 批量创建子预设
async function batchCreatePresets() {
  const presets = batchPreviewList.value;
  if (presets.length === 0) return;

  batchCreating.value = true;
  batchTotal.value = presets.length;
  batchProgress.value = 0;

  let successCount = 0;
  let failCount = 0;

  for (const preset of presets) {
    try {
      await $fetch(`/api/workflow-preset-groups/${token.value}/presets`, {
        method: "POST",
        body: {
          name: preset.name,
          branch: batchBranch.value || groupData.value?.default_branch,
          inputs: { ...batchInputs.value },
          locked_inputs: batchLockedInputs.value,
          allow_branch_override: batchAllowBranchOverride.value,
          allow_sync_override: batchAllowSyncOverride.value,
        },
      });
      successCount++;
    } catch (err) {
      console.error("Failed to create preset:", preset.name, err);
      failCount++;
    }
    batchProgress.value++;
  }

  batchCreating.value = false;
  showBatchCreateModal.value = false;
  await refresh();

  if (failCount === 0) {
    toast.add({ title: `成功创建 ${successCount} 个子预设`, color: "success" });
  } else {
    toast.add({ title: `创建完成：${successCount} 成功，${failCount} 失败`, color: "warning" });
  }
}

// 添加子预设
async function addPreset() {
  if (!newPresetName.value.trim()) return;
  addingPreset.value = true;
  try {
    await $fetch(`/api/workflow-preset-groups/${token.value}/presets`, {
      method: "POST",
      body: {
        name: newPresetName.value.trim(),
        branch: newPresetBranch.value || groupData.value?.default_branch,
        inputs: { ...newPresetInputs.value },
        locked_inputs: newPresetLockedInputs.value,
        allow_branch_override: newPresetAllowBranchOverride.value,
        allow_sync_override: newPresetAllowSyncOverride.value,
      },
    });
    showAddPresetModal.value = false;
    await refresh();
  } catch (err) {
    console.error("Failed to add preset:", err);
    toast.add({ title: (err as { data?: { message?: string } })?.data?.message || "添加失败", color: "error" });
  } finally {
    addingPreset.value = false;
  }
}

// 跳转到预设页面触发
function goToPreset(preset: SubPreset) {
  navigateTo(`/workflows/${preset.share_token}`);
}

// 格式化时间
function formatTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 状态颜色
function getStatusColor(status: string): "info" | "warning" | "neutral" {
  switch (status) {
    case "running":
      return "info";
    case "locked":
      return "warning";
    default:
      return "neutral";
  }
}

// 状态文本
function getStatusText(preset: SubPreset): string {
  if (preset.status === "running") return "运行中";
  if (preset.status === "locked") {
    return `已锁定 (${preset.locked_by_user?.name || "未知"})`;
  }
  return "空闲";
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- 加载中 -->
    <div
      v-if="groupStatus === 'pending'"
      class="flex items-center justify-center min-h-screen"
    >
      <UIcon
        name="i-lucide-loader"
        class="w-8 h-8 animate-spin text-primary-500"
      />
    </div>

    <!-- 错误 -->
    <div
      v-else-if="groupError"
      class="flex flex-col items-center justify-center min-h-screen gap-4"
    >
      <UIcon
        name="i-lucide-alert-circle"
        class="w-16 h-16 text-red-500"
      />
      <p class="text-lg text-gray-600 dark:text-gray-400">
        {{ (groupError as { data?: { message?: string } })?.data?.message || "无法加载预设组" }}
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
    <div
      v-else-if="groupData"
      class="max-w-6xl mx-auto px-4 py-8"
    >
      <!-- 头部 -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-3">
            <UIcon
              name="i-lucide-layers"
              class="w-8 h-8 text-primary-500"
            />
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ groupData.name }}
            </h1>
          </div>
          <div v-if="canManagePresets" class="flex gap-2">
            <UButton
              icon="i-lucide-plus"
              color="primary"
              @click="openAddPresetModal"
            >
              添加子预设
            </UButton>
            <UButton
              icon="i-lucide-copy-plus"
              color="neutral"
              variant="outline"
              @click="openBatchCreateModal"
            >
              批量创建
            </UButton>
          </div>
        </div>
        <p
          v-if="groupData.description"
          class="text-gray-600 dark:text-gray-400 mb-4"
        >
          {{ groupData.description }}
        </p>
        <div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span class="flex items-center gap-1">
            <UIcon name="i-lucide-git-branch" class="w-4 h-4" />
            {{ groupData.repository.full_name }}
          </span>
          <span class="flex items-center gap-1">
            <UIcon name="i-lucide-file-code" class="w-4 h-4" />
            {{ groupData.workflow_path }}
          </span>
          <span class="flex items-center gap-1">
            <UIcon name="i-lucide-user" class="w-4 h-4" />
            {{ groupData.creator.name }}
          </span>
        </div>
      </div>

      <!-- 子预设列表 -->
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="preset in groupData.presets"
          :key="preset.id"
          class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm flex flex-col"
        >
          <!-- 卡片头部 -->
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="font-medium text-gray-900 dark:text-white">
                {{ preset.name }}
              </span>
              <UBadge
                :color="getStatusColor(preset.status)"
                size="xs"
              >
                {{ getStatusText(preset) }}
              </UBadge>
            </div>
            <span class="text-xs text-gray-400">
              #{{ preset.preset_index }}
            </span>
          </div>

          <!-- 配置信息 -->
          <div class="text-sm text-gray-600 dark:text-gray-400 mb-4 space-y-1">
            <div class="flex items-center gap-1">
              <UIcon name="i-lucide-git-branch" class="w-3 h-3" />
              <span>{{ preset.branch }}</span>
            </div>
            <div
              v-if="preset.auto_unlock_at"
              class="flex items-center gap-1"
            >
              <UIcon name="i-lucide-clock" class="w-3 h-3" />
              <span>自动解锁: {{ formatTime(preset.auto_unlock_at) }}</span>
            </div>
          </div>

          <!-- 锁定者信息 -->
          <div
            v-if="preset.locked_by_user"
            class="flex items-center gap-2 mb-4 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded"
          >
            <UAvatar
              :src="preset.locked_by_user.avatar_url || undefined"
              :alt="preset.locked_by_user.name"
              size="xs"
            />
            <span class="text-sm text-yellow-700 dark:text-yellow-300">
              {{ preset.locked_by_user.name }} 锁定于 {{ formatTime(preset.locked_at) }}
            </span>
          </div>

          <!-- 操作按钮 -->
          <div class="flex gap-2 flex-wrap mt-auto pt-4">
            <!-- 未锁定状态 -->
            <template v-if="!preset.locked_by">
              <UButton
                v-if="loggedIn"
                color="primary"
                size="sm"
                :loading="lockingIndex === preset.preset_index"
                @click="lockPreset(preset.preset_index)"
              >
                <UIcon name="i-lucide-lock" class="w-4 h-4 mr-1" />
                锁定
              </UButton>
              <UButton
                color="neutral"
                size="sm"
                @click="goToPreset(preset)"
              >
                <UIcon name="i-lucide-external-link" class="w-4 h-4 mr-1" />
                打开
              </UButton>
              <UButton
                v-if="canManagePresets"
                color="error"
                variant="ghost"
                size="sm"
                :loading="deletingIndex === preset.preset_index"
                @click="deletePreset(preset.preset_index)"
              >
                <UIcon name="i-lucide-trash-2" class="w-4 h-4" />
              </UButton>
            </template>

            <!-- 被我锁定 -->
            <template v-else-if="isLockedByMe(preset)">
              <UButton
                color="warning"
                size="sm"
                :loading="unlockingIndex === preset.preset_index"
                @click="unlockPreset(preset.preset_index)"
              >
                <UIcon name="i-lucide-unlock" class="w-4 h-4 mr-1" />
                解锁
              </UButton>
              <UButton
                color="primary"
                size="sm"
                @click="goToPreset(preset)"
              >
                <UIcon name="i-lucide-play" class="w-4 h-4 mr-1" />
                触发
              </UButton>
              <UButton
                v-if="canManagePresets"
                color="error"
                variant="ghost"
                size="sm"
                :loading="deletingIndex === preset.preset_index"
                @click="deletePreset(preset.preset_index)"
              >
                <UIcon name="i-lucide-trash-2" class="w-4 h-4" />
              </UButton>
            </template>

            <!-- 被他人锁定 -->
            <template v-else>
              <UButton
                color="neutral"
                size="sm"
                @click="goToPreset(preset)"
              >
                <UIcon name="i-lucide-external-link" class="w-4 h-4 mr-1" />
                打开
              </UButton>
              <UButton
                v-if="loggedIn"
                color="warning"
                variant="outline"
                size="sm"
                :loading="requestingUnlockIndex === preset.preset_index"
                @click="requestUnlock(preset.preset_index)"
              >
                <UIcon name="i-lucide-hand" class="w-4 h-4 mr-1" />
                申请解锁
              </UButton>
              <UButton
                v-if="canManagePresets"
                color="error"
                variant="ghost"
                size="sm"
                :loading="deletingIndex === preset.preset_index"
                @click="deletePreset(preset.preset_index)"
              >
                <UIcon name="i-lucide-trash-2" class="w-4 h-4" />
              </UButton>
            </template>
          </div>
        </div>

        <!-- 空状态 -->
        <div
          v-if="groupData.presets.length === 0"
          class="col-span-full flex flex-col items-center justify-center py-12 text-gray-500"
        >
          <UIcon name="i-lucide-inbox" class="w-12 h-12 mb-4" />
          <p>暂无子预设</p>
          <UButton
            v-if="canManagePresets"
            icon="i-lucide-plus"
            color="primary"
            variant="soft"
            class="mt-4"
            @click="openAddPresetModal"
          >
            添加第一个子预设
          </UButton>
        </div>
      </div>

      <!-- 批量创建子预设 Modal -->
      <UModal v-model:open="showBatchCreateModal">
        <template #content>
          <div class="p-6 flex flex-col max-h-[85vh]">
            <h3 class="text-lg font-semibold">
              批量创建子预设
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
              通过模板快速创建多个子预设
            </p>

            <div class="flex-1 overflow-y-auto space-y-4 pr-1">
              <!-- 循环模式选择 -->
              <div>
                <label class="block text-sm font-medium mb-2">循环模式</label>
                <div class="flex gap-4">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      v-model="batchLoopMode"
                      type="radio"
                      value="range"
                      class="text-primary-500"
                    >
                    <span class="text-sm">数字范围</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      v-model="batchLoopMode"
                      type="radio"
                      value="list"
                      class="text-primary-500"
                    >
                    <span class="text-sm">自定义列表</span>
                  </label>
                </div>
              </div>

              <!-- 数字范围 -->
              <div v-if="batchLoopMode === 'range'" class="flex gap-4">
                <div class="flex-1">
                  <label class="block text-sm font-medium mb-1">起始值</label>
                  <UInput
                    v-model.number="batchRangeStart"
                    type="number"
                    :min="1"
                    class="w-full"
                  />
                </div>
                <div class="flex-1">
                  <label class="block text-sm font-medium mb-1">结束值</label>
                  <UInput
                    v-model.number="batchRangeEnd"
                    type="number"
                    :min="batchRangeStart"
                    :max="batchRangeStart + 99"
                    class="w-full"
                  />
                </div>
              </div>

              <!-- 自定义列表 -->
              <div v-else>
                <label class="block text-sm font-medium mb-1">名称列表</label>
                <UTextarea
                  v-model="batchCustomList"
                  placeholder="输入名称，用逗号或换行分隔&#10;例如：测试环境, 预发环境, 生产环境"
                  :rows="3"
                  class="w-full"
                />
              </div>

              <!-- 名称模板 -->
              <div>
                <label class="block text-sm font-medium mb-1">名称模板</label>
                <UInput
                  v-model="batchNameTemplate"
                  placeholder="子预设 {i}"
                  class="w-full"
                />
                <p class="text-xs text-gray-400 mt-1">
                  支持占位符：<code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">{i}</code> 序号，
                  <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">{name}</code> 列表项名称
                </p>
              </div>

              <!-- 分支 -->
              <div>
                <label class="block text-sm font-medium mb-1">分支</label>
                <UInput
                  v-model="batchBranch"
                  :placeholder="groupData?.default_branch || 'main'"
                  class="w-full"
                />
              </div>

              <!-- Workflow Inputs -->
              <template v-if="Object.keys(groupData?.workflow_inputs || {}).length > 0">
                <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                    工作流参数（所有预设共用）
                  </p>
                  <WorkflowInputsForm
                    :input-defs="groupData?.workflow_inputs || {}"
                    :model-value="batchInputs"
                    :locked-inputs="batchLockedInputs"
                    :show-lock-button="true"
                    @update:model-value="batchInputs = $event"
                    @update:locked-inputs="batchLockedInputs = $event"
                  />
                </div>
              </template>

              <!-- 覆盖选项 -->
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <div>
                    <label class="text-sm font-medium">允许用户修改分支</label>
                  </div>
                  <USwitch v-model="batchAllowBranchOverride" />
                </div>
                <div class="flex items-center justify-between">
                  <div>
                    <label class="text-sm font-medium">允许同步用户修改</label>
                  </div>
                  <USwitch v-model="batchAllowSyncOverride" />
                </div>
              </div>

              <!-- 预览 -->
              <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
                <p class="text-sm font-medium mb-2">
                  预览（将创建 {{ batchPreviewList.length }} 个子预设）
                </p>
                <div
                  v-if="batchPreviewList.length > 0"
                  class="max-h-32 overflow-y-auto bg-gray-50 dark:bg-gray-800 rounded-lg p-2 space-y-1"
                >
                  <div
                    v-for="(item, idx) in batchPreviewList.slice(0, 20)"
                    :key="idx"
                    class="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2"
                  >
                    <UIcon name="i-lucide-file" class="w-3 h-3" />
                    <span>{{ item.name }}</span>
                  </div>
                  <div
                    v-if="batchPreviewList.length > 20"
                    class="text-xs text-gray-400 pl-5"
                  >
                    ... 还有 {{ batchPreviewList.length - 20 }} 个
                  </div>
                </div>
                <div
                  v-else
                  class="text-sm text-gray-400"
                >
                  请配置循环参数
                </div>
              </div>

              <!-- 进度条 -->
              <div v-if="batchCreating" class="space-y-2">
                <div class="flex justify-between text-sm">
                  <span>创建进度</span>
                  <span>{{ batchProgress }} / {{ batchTotal }}</span>
                </div>
                <UProgress
                  :value="batchProgress"
                  :max="batchTotal"
                  color="primary"
                />
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
              <UButton
                color="neutral"
                variant="ghost"
                :disabled="batchCreating"
                @click="showBatchCreateModal = false"
              >
                取消
              </UButton>
              <UButton
                icon="i-lucide-copy-plus"
                color="primary"
                :loading="batchCreating"
                :disabled="batchPreviewList.length === 0"
                @click="batchCreatePresets"
              >
                创建 {{ batchPreviewList.length }} 个
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- 添加子预设 Modal -->
      <UModal v-model:open="showAddPresetModal">
        <template #content>
          <div class="p-6 flex flex-col max-h-[80vh]">
            <h3 class="text-lg font-semibold">
              添加子预设
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
              为预设组添加一个新的子预设
            </p>

            <div class="flex-1 overflow-y-auto space-y-4 pr-1">
              <WorkflowPresetConfigForm
                v-model:name="newPresetName"
                v-model:branch="newPresetBranch"
                v-model:allow-branch-override="newPresetAllowBranchOverride"
                v-model:allow-sync-override="newPresetAllowSyncOverride"
                :inputs="newPresetInputs"
                :input-defs="groupData?.workflow_inputs || {}"
                :locked-inputs="newPresetLockedInputs"
                :show-override-options="true"
                name-placeholder="如：测试环境 1"
                :branch-placeholder="groupData?.default_branch || 'main'"
                @update:inputs="newPresetInputs = $event"
                @update:locked-inputs="newPresetLockedInputs = $event"
              />
            </div>

            <div class="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
              <UButton
                color="neutral"
                variant="ghost"
                @click="showAddPresetModal = false"
              >
                取消
              </UButton>
              <UButton
                icon="i-lucide-plus"
                color="primary"
                :loading="addingPreset"
                :disabled="!newPresetName.trim()"
                @click="addPreset"
              >
                添加
              </UButton>
            </div>
          </div>
        </template>
      </UModal>
    </div>
  </div>
</template>
