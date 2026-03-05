<script setup lang="ts">
import type { PermissionGroup, PermissionDef } from "~/types/admin";

interface ProjectItem {
  id: string;
  name: string;
  fullName: string;
}

const props = defineProps<{
  orgId: string;
  allGroups: PermissionGroup[];
  availablePermissions: PermissionDef[];
}>();

const emit = defineEmits<{
  refreshGroups: [];
}>();

const toast = useToast();

const showGroupForm = ref(false);
const editingGroup = ref<PermissionGroup | null>(null);
const formName = ref("");
const formDescription = ref("");
const formPermissions = ref<string[]>([]);
const formScopeAll = ref(true);
const formProjectIds = ref<string[]>([]);
const formLoading = ref(false);

const { data: projectsData } = useFetch<{ data: ProjectItem[] }>(`/api/orgs/${props.orgId}/projects?limit=100`);
const projectList = computed(() => projectsData.value?.data ?? []);

function openCreateGroup() {
  editingGroup.value = null;
  formName.value = "";
  formDescription.value = "";
  formPermissions.value = [];
  formScopeAll.value = true;
  formProjectIds.value = [];
  showGroupForm.value = true;
}

function openEditGroup(group: PermissionGroup) {
  editingGroup.value = group;
  formName.value = group.name;
  formDescription.value = group.description || "";
  formPermissions.value = [...(group.permissions || [])];
  formScopeAll.value = group.projectIds === null;
  formProjectIds.value = group.projectIds ? [...group.projectIds] : [];
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

function toggleProject(id: string) {
  const idx = formProjectIds.value.indexOf(id);
  if (idx >= 0) {
    formProjectIds.value.splice(idx, 1);
  } else {
    formProjectIds.value.push(id);
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
        `/api/orgs/${props.orgId}/permissions/${editingGroup.value.id}`,
        {
          method: "PUT",
          body: {
            name: formName.value,
            description: formDescription.value,
            permissions: formPermissions.value,
            projectIds: formScopeAll.value ? null : formProjectIds.value,
          },
        },
      );
      toast.add({ title: "权限组已更新", color: "success" });
    } else {
      await $fetch(`/api/orgs/${props.orgId}/permissions`, {
        method: "POST",
        body: {
          name: formName.value,
          description: formDescription.value,
          permissions: formPermissions.value,
          projectIds: formScopeAll.value ? null : formProjectIds.value,
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
    await $fetch(`/api/orgs/${props.orgId}/permissions/${group.id}`, {
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
            <div class="flex flex-wrap gap-1.5 mt-3">
              <UBadge
                v-if="group.projectIds === null"
                color="neutral"
                variant="subtle"
                size="sm"
              >
                全部项目
              </UBadge>
              <UBadge
                v-else
                color="warning"
                variant="subtle"
                size="sm"
              >
                {{ group.projectIds.length }} 个项目
              </UBadge>
            </div>
            <div
              v-if="group.permissions && group.permissions.length > 0"
              class="flex flex-wrap gap-1.5 mt-2"
            >
              <UBadge
                v-for="perm in group.permissions"
                :key="perm"
                color="primary"
                variant="subtle"
                size="sm"
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

            <div>
              <label class="block text-sm font-medium mb-2">项目范围</label>
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
                  全部项目
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
                  指定项目
                </button>
                <div
                  v-if="!formScopeAll"
                  class="pl-6 space-y-1 max-h-48 overflow-y-auto"
                >
                  <button
                    v-for="project in projectList"
                    :key="project.id"
                    type="button"
                    class="flex items-center gap-2 p-1.5 rounded text-sm w-full text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-900"
                    @click="toggleProject(project.id)"
                  >
                    <UIcon
                      :name="formProjectIds.includes(project.id) ? 'i-lucide-check-square' : 'i-lucide-square'"
                      class="w-4 h-4 shrink-0"
                    />
                    {{ project.fullName || project.name }}
                  </button>
                  <p
                    v-if="projectList.length === 0"
                    class="text-sm text-gray-400"
                  >
                    暂无项目
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">权限</label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="perm in availablePermissions"
                  :key="perm.key"
                  type="button"
                  class="flex items-center gap-2 p-2 rounded-lg border text-sm text-left transition-colors"
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
