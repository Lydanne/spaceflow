<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: "admin",
});

interface UserItem {
  id: string;
  giteaId: number;
  giteaUsername: string;
  email: string;
  avatarUrl: string | null;
  isAdmin: boolean | null;
  createdAt: string;
  updatedAt: string;
}

const toast = useToast();
const page = ref(1);
const limit = 20;

const { data, refresh, status } = await useFetch<{
  data: UserItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}>("/api/admin/users", {
  query: { page, limit },
});

const users = computed(() => data.value?.data ?? []);
const total = computed(() => data.value?.total ?? 0);

async function toggleAdmin(user: UserItem) {
  try {
    await $fetch(`/api/admin/users/${user.id}/toggle-admin`, {
      method: "POST",
    });
    toast.add({
      title: user.isAdmin ? "已取消管理员" : "已设为管理员",
      color: "success",
    });
    await refresh();
  } catch (err: unknown) {
    const msg
      = (err as { data?: { message?: string } })?.data?.message || "操作失败";
    toast.add({ title: msg, color: "error" });
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
          { accessorKey: 'giteaUsername', header: '用户名' },
          { accessorKey: 'email', header: '邮箱' },
          { accessorKey: 'isAdmin', header: '角色' },
          { accessorKey: 'createdAt', header: '注册时间' },
          { accessorKey: 'actions', header: '操作' },
        ]"
      >
        <template #giteaUsername-cell="{ row }">
          <div class="flex items-center gap-2">
            <UAvatar
              :src="row.original.avatarUrl || undefined"
              :alt="row.original.giteaUsername"
              size="xs"
            />
            <span class="font-medium">{{ row.original.giteaUsername }}</span>
          </div>
        </template>

        <template #isAdmin-cell="{ row }">
          <UBadge
            :color="row.original.isAdmin ? 'primary' : 'neutral'"
            variant="subtle"
            size="sm"
          >
            {{ row.original.isAdmin ? "管理员" : "普通用户" }}
          </UBadge>
        </template>

        <template #createdAt-cell="{ row }">
          <span class="text-sm text-gray-500">
            {{ new Date(row.original.createdAt).toLocaleDateString("zh-CN") }}
          </span>
        </template>

        <template #actions-cell="{ row }">
          <UButton
            size="xs"
            :color="row.original.isAdmin ? 'neutral' : 'primary'"
            variant="soft"
            @click="toggleAdmin(row.original)"
          >
            {{ row.original.isAdmin ? "取消管理员" : "设为管理员" }}
          </UButton>
        </template>
      </UTable>

      <div
        v-if="total > limit"
        class="flex justify-center pt-4"
      >
        <UPagination
          v-model="page"
          :total="total"
          :items-per-page="limit"
        />
      </div>
    </UCard>
  </div>
</template>
