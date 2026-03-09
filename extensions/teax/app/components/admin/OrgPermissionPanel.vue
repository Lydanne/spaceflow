<script setup lang="ts">
import type { PermissionGroup, PermissionDef } from "~/types/admin";

interface RepositoryItem {
  id: string;
  name: string;
  full_name: string;
}

const props = withDefaults(defineProps<{
  orgName: string;
  allGroups: PermissionGroup[];
  availablePermissions: PermissionDef[];
  showRepoScope?: boolean;
}>(), {
  showRepoScope: true,
});

const emit = defineEmits<{
  refreshGroups: [];
}>();

const toast = useToast();

const showGroupForm = ref(false);
const showPermissionBuilder = ref(false);
const editingGroup = ref<PermissionGroup | null>(null);
const formName = ref("");
const formDescription = ref("");
const formPermissions = ref<string[]>([]);
const formScopeAll = ref(true);
const formRepositoryIds = ref<string[]>([]);
const formLoading = ref(false);

// 保存编辑 Modal 的状态，用于从权限构建器返回时恢复
const savedFormState = ref<{
  editing: PermissionGroup | null;
  name: string;
  description: string;
  permissions: string[];
  scopeAll: boolean;
  repositoryIds: string[];
} | null>(null);

const { data: reposData } = useFetch<{ data: RepositoryItem[] }>(`/api/orgs/${props.orgName}/projects?limit=100`);
const repoList = computed(() => reposData.value?.data ?? []);

function openCreateGroup() {
  editingGroup.value = null;
  formName.value = "";
  formDescription.value = "";
  formPermissions.value = [];
  formScopeAll.value = true;
  formRepositoryIds.value = [];
  showGroupForm.value = true;
}

function openEditGroup(group: PermissionGroup) {
  editingGroup.value = group;
  formName.value = group.name;
  formDescription.value = group.description || "";
  formPermissions.value = [...(group.permissions || [])];
  formScopeAll.value = !props.showRepoScope || group.repository_ids === null;
  formRepositoryIds.value = group.repository_ids ? [...group.repository_ids] : [];
  showGroupForm.value = true;
}

function cancelGroupForm() {
  showGroupForm.value = false;
  editingGroup.value = null;
}

function togglePermission(key: string) {
  const idx = formPermissions.value.indexOf(key);
  if (idx >= 0) {
    formPermissions.value.splice(idx, 1);
  } else {
    formPermissions.value.push(key);
  }
}

function toggleRepo(id: string) {
  const idx = formRepositoryIds.value.indexOf(id);
  if (idx >= 0) {
    formRepositoryIds.value.splice(idx, 1);
  } else {
    formRepositoryIds.value.push(id);
  }
}

const permissionGroupDefs: { key: string; label: string }[] = [
  { key: "repo", label: "仓库" },
  { key: "actions", label: "Actions" },
  { key: "agent", label: "Agent" },
  { key: "page", label: "Pages" },
  { key: "miniapp", label: "小程序" },
  { key: "team", label: "团队" },
  { key: "settings", label: "设置" },
];

const groupedPermissions = computed(() => {
  return permissionGroupDefs
    .map((g) => ({
      ...g,
      permissions: props.availablePermissions.filter((p) => p.group === g.key),
    }))
    .filter((g) => g.permissions.length > 0);
});

function isGroupAllSelected(groupKey: string) {
  const keys = props.availablePermissions
    .filter((p) => p.group === groupKey)
    .map((p) => p.key);
  return keys.length > 0 && keys.every((k) => formPermissions.value.includes(k));
}

function toggleGroupAll(groupKey: string) {
  const keys = props.availablePermissions
    .filter((p) => p.group === groupKey)
    .map((p) => p.key);
  if (isGroupAllSelected(groupKey)) {
    formPermissions.value = formPermissions.value.filter((k) => !keys.includes(k));
  } else {
    for (const k of keys) {
      if (!formPermissions.value.includes(k)) {
        formPermissions.value.push(k);
      }
    }
  }
}

async function saveGroup() {
  if (!formName.value.trim()) {
    toast.add({ title: "名称不能为空", color: "error" });
    return;
  }
  formLoading.value = true;
  try {
    if (editingGroup.value) {
      await $fetch(
        `/api/orgs/${props.orgName}/permissions/${editingGroup.value.id}`,
        {
          method: "PUT",
          body: {
            name: formName.value,
            description: formDescription.value,
            permissions: formPermissions.value,
            repository_ids: formScopeAll.value ? null : formRepositoryIds.value,
          },
        },
      );
      toast.add({ title: "权限组已更新", color: "success" });
    } else {
      await $fetch(`/api/orgs/${props.orgName}/permissions`, {
        method: "POST",
        body: {
          name: formName.value,
          description: formDescription.value,
          permissions: formPermissions.value,
          repository_ids: formScopeAll.value ? null : formRepositoryIds.value,
        },
      });
      toast.add({ title: "权限组已创建", color: "success" });
    }
    showGroupForm.value = false;
    editingGroup.value = null;
    emit("refreshGroups");
  } catch {
    toast.add({ title: "操作失败", color: "error" });
  } finally {
    formLoading.value = false;
  }
}

async function deleteGroup(group: PermissionGroup) {
  if (
    !confirm(`确定删除权限组「${group.name}」？关联的团队权限分配也会被移除。`)
  )
    return;
  try {
    await $fetch(`/api/orgs/${props.orgName}/permissions/${group.id}`, {
      method: "DELETE",
    });
    toast.add({ title: "权限组已删除", color: "success" });
    emit("refreshGroups");
  } catch {
    toast.add({ title: "删除失败", color: "error" });
  }
}

function getPermissionLabel(key: string) {
  return props.availablePermissions.find((p) => p.key === key)?.label || key;
}

function openPermissionBuilder() {
  // 保存当前表单状态
  savedFormState.value = {
    editing: editingGroup.value,
    name: formName.value,
    description: formDescription.value,
    permissions: [...formPermissions.value],
    scopeAll: formScopeAll.value,
    repositoryIds: [...formRepositoryIds.value],
  };
  // 临时关闭编辑 Modal
  showGroupForm.value = false;
  // 打开权限构建器
  showPermissionBuilder.value = true;
}

function handleAddPermission(permission: string) {
  showPermissionBuilder.value = false;

  // 恢复编辑 Modal
  if (savedFormState.value) {
    editingGroup.value = savedFormState.value.editing;
    formName.value = savedFormState.value.name;
    formDescription.value = savedFormState.value.description;
    formPermissions.value = [...savedFormState.value.permissions];
    formScopeAll.value = savedFormState.value.scopeAll;
    formRepositoryIds.value = [...savedFormState.value.repositoryIds];

    // 添加新权限（在恢复状态之后）
    if (!formPermissions.value.includes(permission)) {
      formPermissions.value.push(permission);
    }

    showGroupForm.value = true;
    savedFormState.value = null;
  }
}

function removePermission(index: number) {
  formPermissions.value.splice(index, 1);
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-gray-500 dark:text-gray-400">
        创建权限组并分配给团队，团队成员自动继承权限
      </p>
      <UButton
        icon="i-lucide-plus"
        color="primary"
        @click="openCreateGroup"
      >
        新建权限组
      </UButton>
    </div>

    <div class="space-y-4">
      <UCard
        v-for="group in allGroups"
        :key="group.id"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <h3 class="font-semibold text-base">
              {{ group.name }}
            </h3>
            <p
              v-if="group.description"
              class="text-sm text-gray-500 dark:text-gray-400 mt-1"
            >
              {{ group.description }}
            </p>
            <div class="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
              <template v-if="showRepoScope">
                <UIcon
                  name="i-lucide-folder"
                  class="w-3.5 h-3.5"
                />
                <span v-if="group.repository_ids === null">全部仓库</span>
                <span v-else>{{ group.repository_ids.length }} 个仓库</span>
                <span class="mx-1">·</span>
              </template>
              <span>{{ (group.permissions || []).length }} 项权限</span>
            </div>
            <div
              v-if="group.permissions && group.permissions.length > 0"
              class="flex flex-wrap gap-1 mt-2"
            >
              <UBadge
                v-for="perm in group.permissions"
                :key="perm"
                color="primary"
                variant="subtle"
                size="xs"
              >
                {{ getPermissionLabel(perm) }}
              </UBadge>
            </div>
            <p
              v-else
              class="text-sm text-gray-400 mt-2"
            >
              未分配权限（只读）
            </p>
          </div>
          <div class="flex items-center gap-1 ml-4 shrink-0">
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-pencil"
              @click="openEditGroup(group)"
            >
              编辑
            </UButton>
            <UButton
              v-if="group.type !== 'default'"
              size="xs"
              color="error"
              variant="soft"
              icon="i-lucide-trash-2"
              @click="deleteGroup(group)"
            >
              删除
            </UButton>
          </div>
        </div>
      </UCard>

      <div
        v-if="allGroups.length === 0"
        class="text-center py-12 text-gray-400"
      >
        <UIcon
          name="i-lucide-shield"
          class="w-12 h-12 mx-auto mb-3"
        />
        <p>暂无权限组</p>
        <p class="text-sm mt-1">
          点击"新建权限组"创建第一个权限组
        </p>
      </div>
    </div>

    <!-- 权限构建器 Modal -->
    <UModal v-model:open="showPermissionBuilder">
      <template #content>
        <div class="p-6">
          <PermissionBuilder @add="handleAddPermission" />
        </div>
      </template>
    </UModal>

    <!-- 权限组 创建/编辑 Modal -->
    <UModal v-model:open="showGroupForm">
      <template #content>
        <div class="p-6">
          <h2 class="text-lg font-bold mb-4">
            {{ editingGroup ? "编辑权限组" : "新建权限组" }}
          </h2>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">名称</label>
              <UInput
                v-model="formName"
                placeholder="如：开发者、管理员、只读"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-1">描述</label>
              <UTextarea
                v-model="formDescription"
                placeholder="权限组用途说明"
                :rows="2"
              />
            </div>

            <div v-if="showRepoScope">
              <label class="block text-sm font-medium mb-2">仓库范围</label>
              <div class="space-y-2">
                <button
                  type="button"
                  class="flex items-center gap-2 p-2 rounded-lg border text-sm w-full text-left transition-colors"
                  :class="formScopeAll ? 'border-primary-500 bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300' : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900'"
                  @click="formScopeAll = true"
                >
                  <UIcon
                    :name="formScopeAll ? 'i-lucide-circle-dot' : 'i-lucide-circle'"
                    class="w-4 h-4 shrink-0"
                  />
                  全部仓库
                </button>
                <button
                  type="button"
                  class="flex items-center gap-2 p-2 rounded-lg border text-sm w-full text-left transition-colors"
                  :class="!formScopeAll ? 'border-primary-500 bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300' : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900'"
                  @click="formScopeAll = false"
                >
                  <UIcon
                    :name="!formScopeAll ? 'i-lucide-circle-dot' : 'i-lucide-circle'"
                    class="w-4 h-4 shrink-0"
                  />
                  指定仓库
                </button>
                <div
                  v-if="!formScopeAll"
                  class="pl-6 space-y-1 max-h-48 overflow-y-auto"
                >
                  <button
                    v-for="repo in repoList"
                    :key="repo.id"
                    type="button"
                    class="flex items-center gap-2 p-1.5 rounded text-sm w-full text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-900"
                    @click="toggleRepo(repo.id)"
                  >
                    <UIcon
                      :name="formRepositoryIds.includes(repo.id) ? 'i-lucide-check-square' : 'i-lucide-square'"
                      class="w-4 h-4 shrink-0"
                    />
                    {{ repo.full_name || repo.name }}
                  </button>
                  <p
                    v-if="repoList.length === 0"
                    class="text-sm text-gray-400"
                  >
                    暂无仓库
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">权限</label>

              <!-- 权限构建器按钮 -->
              <div class="mb-3">
                <UButton
                  size="sm"
                  variant="outline"
                  icon="i-lucide-wand-2"
                  @click="openPermissionBuilder"
                >
                  使用权限构建器
                </UButton>
              </div>

              <!-- 已选权限列表（可视化展示） -->
              <div
                v-if="formPermissions.length > 0"
                class="mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  已选权限 ({{ formPermissions.length }})
                </div>
                <div class="flex flex-wrap gap-2">
                  <UBadge
                    v-for="(perm, idx) in formPermissions"
                    :key="idx"
                    size="lg"
                    variant="subtle"
                    color="primary"
                  >
                    <div class="flex items-center gap-2">
                      <PermissionBadge :permission="perm" />
                      <UButton
                        icon="i-lucide-x"
                        size="xs"
                        variant="ghost"
                        @click="removePermission(idx)"
                      />
                    </div>
                  </UBadge>
                </div>
              </div>

              <div class="space-y-3 max-h-64 overflow-y-auto">
                <div
                  v-for="group in groupedPermissions"
                  :key="group.key"
                >
                  <div class="flex items-center justify-between mb-1.5">
                    <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ group.label }}</span>
                    <button
                      type="button"
                      class="text-xs text-primary-500 hover:text-primary-600 dark:hover:text-primary-400"
                      @click="toggleGroupAll(group.key)"
                    >
                      {{ isGroupAllSelected(group.key) ? "取消全选" : "全选" }}
                    </button>
                  </div>
                  <div class="grid grid-cols-2 gap-1.5">
                    <button
                      v-for="perm in group.permissions"
                      :key="perm.key"
                      type="button"
                      class="flex items-center gap-2 px-2 py-1.5 rounded-md border text-sm text-left transition-colors"
                      :class="
                        formPermissions.includes(perm.key)
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300'
                          : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900'
                      "
                      @click="togglePermission(perm.key)"
                    >
                      <UIcon
                        :name="
                          formPermissions.includes(perm.key)
                            ? 'i-lucide-check-square'
                            : 'i-lucide-square'
                        "
                        class="w-4 h-4 shrink-0"
                      />
                      {{ perm.label }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-2 mt-6">
            <UButton
              color="neutral"
              variant="soft"
              @click="cancelGroupForm"
            >
              取消
            </UButton>
            <UButton
              color="primary"
              :loading="formLoading"
              @click="saveGroup"
            >
              {{ editingGroup ? "保存" : "创建" }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
