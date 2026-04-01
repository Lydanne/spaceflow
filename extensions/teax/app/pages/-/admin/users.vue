<script setup lang="ts">
import type { AdminUserListItemDto, AdminUsersResponseDto } from "~~/server/shared/dto";

definePageMeta({
  layout: "admin",
  middleware: "admin",
});

const toast = useToast();
const page = ref(1);
const limit = 20;

const { data, refresh, status } = await useFetch<AdminUsersResponseDto>("/api/admin/users", {
  query: { page, limit },
  watch: [page],
});

const users = computed(() => data.value?.data ?? []);
const total = computed(() => data.value?.total ?? 0);

// 删除确认状态
const showDeleteModal = ref(false);
const userToDelete = ref<AdminUserListItemDto | null>(null);
const confirmUsername = ref("");
const isDeleting = ref(false);

async function toggleAdmin(user: AdminUserListItemDto) {
  try {
    await $fetch(`/api/admin/users/${user.id}/toggle-admin`, {
      method: "POST",
    });
    toast.add({
      title: user.is_admin ? "已取消管理员" : "已设为管理员",
      color: "success",
    });
    await refresh();
  } catch (err: unknown) {
    const msg
      = (err as { data?: { message?: string } })?.data?.message || "操作失败";
    toast.add({ title: msg, color: "error" });
  }
}

function promptDelete(user: AdminUserListItemDto) {
  userToDelete.value = user;
  confirmUsername.value = "";
  showDeleteModal.value = true;
}

function cancelDelete() {
  showDeleteModal.value = false;
  userToDelete.value = null;
  confirmUsername.value = "";
}

async function confirmDelete() {
  if (!userToDelete.value) return;

  // 验证用户名输入
  if (confirmUsername.value !== userToDelete.value.gitea_username) {
    toast.add({ title: "输入的用户名不匹配", color: "error" });
    return;
  }

  isDeleting.value = true;
  try {
    await $fetch(`/api/admin/users/${userToDelete.value.id}`, {
      method: "DELETE",
    });
    toast.add({
      title: `用户 ${userToDelete.value.gitea_username} 已删除`,
      color: "success",
    });
    showDeleteModal.value = false;
    userToDelete.value = null;
    confirmUsername.value = "";
    await refresh();
  } catch (err: unknown) {
    const msg
      = (err as { data?: { message?: string } })?.data?.message || "删除失败";
    toast.add({ title: msg, color: "error" });
  } finally {
    isDeleting.value = false;
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-bold">
          用户管理
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          共 {{ total }} 位用户
        </p>
      </div>
    </div>

    <UCard>
      <div
        v-if="status === 'pending'"
        class="flex justify-center py-8"
      >
        <UIcon
          name="i-lucide-loader-2"
          class="w-6 h-6 animate-spin text-gray-400"
        />
      </div>

      <UTable
        v-else
        :data="users"
        :columns="[
          { accessorKey: 'gitea_username', header: '用户名' },
          { accessorKey: 'email', header: '邮箱' },
          { accessorKey: 'is_admin', header: '角色' },
          { accessorKey: 'created_at', header: '注册时间' },
          { accessorKey: 'actions', header: '操作' },
        ]"
      >
        <template #gitea_username-cell="{ row }">
          <div class="flex items-center gap-2">
            <UAvatar
              :src="row.original.avatar_url || undefined"
              :alt="row.original.gitea_username"
              size="xs"
            />
            <span class="font-medium">{{ row.original.gitea_username }}</span>
          </div>
        </template>

        <template #is_admin-cell="{ row }">
          <UBadge
            :color="row.original.is_admin ? 'primary' : 'neutral'"
            variant="subtle"
            size="sm"
          >
            {{ row.original.is_admin ? "管理员" : "普通用户" }}
          </UBadge>
        </template>

        <template #created_at-cell="{ row }">
          <span class="text-sm text-gray-500">
            {{ new Date(row.original.created_at).toLocaleDateString("zh-CN") }}
          </span>
        </template>

        <template #actions-cell="{ row }">
          <div class="flex items-center gap-2">
            <UButton
              size="xs"
              :color="row.original.is_admin ? 'neutral' : 'primary'"
              variant="soft"
              @click="toggleAdmin(row.original)"
            >
              {{ row.original.is_admin ? "取消管理员" : "设为管理员" }}
            </UButton>
            <UButton
              size="xs"
              color="error"
              variant="soft"
              @click="promptDelete(row.original)"
            >
              删除
            </UButton>
          </div>
        </template>
      </UTable>

      <div
        v-if="total > limit"
        class="flex justify-center pt-4"
      >
        <UPagination
          v-model:page="page"
          :total="total"
          :items-per-page="limit"
        />
      </div>
    </UCard>

    <!-- 删除确认弹窗 -->
    <UModal v-model:open="showDeleteModal">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center gap-2 text-error">
              <UIcon name="i-lucide-alert-triangle" class="w-5 h-5" />
              <span class="font-bold">确认删除用户</span>
            </div>
          </template>

          <div v-if="userToDelete" class="space-y-4">
            <p class="text-sm text-gray-600 dark:text-gray-300">
              您即将删除用户 <span class="font-bold text-error">{{ userToDelete.gitea_username }}</span>。
              此操作不可撤销，该用户的所有数据将被永久删除。
            </p>

            <div class="p-3 bg-error/10 rounded-lg text-sm text-error">
              <p class="font-medium">警告：</p>
              <ul class="list-disc list-inside mt-1 space-y-1">
                <li>用户的飞书绑定将被解除</li>
                <li>用户将从所有团队中移除</li>
                <li>用户将无法再登录系统</li>
              </ul>
            </div>

            <UFormField label="请输入用户名确认删除" required>
              <UInput
                v-model="confirmUsername"
                placeholder="输入用户名"
                :disabled="isDeleting"
              />
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                color="neutral"
                variant="ghost"
                :disabled="isDeleting"
                @click="cancelDelete"
              >
                取消
              </UButton>
              <UButton
                color="error"
                :loading="isDeleting"
                :disabled="confirmUsername !== userToDelete?.gitea_username"
                @click="confirmDelete"
              >
                确认删除
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
