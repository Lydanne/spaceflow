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
const addingPreset = ref(false);

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
  showAddPresetModal.value = true;
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
          <UButton
            v-if="canManagePresets"
            icon="i-lucide-plus"
            color="primary"
            @click="openAddPresetModal"
          >
            添加子预设
          </UButton>
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
