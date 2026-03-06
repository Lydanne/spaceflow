<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: "admin",
});

interface OrgItem {
  id: string;
  gitea_org_id: number;
  name: string;
  full_name: string | null;
  avatar_url: string | null;
  synced_at: string | null;
  created_at: string;
  teamCount: number;
  member_count: number;
}

const toast = useToast();
const page = ref(1);
const limit = 20;

const { data, refresh, status } = await useFetch<{
  data: OrgItem[];
  total: number;
}>("/api/admin/orgs", {
  query: { page, limit },
});

const orgs = computed(() => data.value?.data ?? []);
const total = computed(() => data.value?.total ?? 0);

const syncing = ref<string | null>(null);

async function syncOrg(org: OrgItem) {
  syncing.value = org.id;
  try {
    await $fetch(`/api/admin/orgs/${org.id}/sync`, { method: "POST" });
    toast.add({ title: `已同步组织 ${org.name}`, color: "success" });
    await refresh();
  } catch (err: unknown) {
    const msg =
      (err as { data?: { message?: string } })?.data?.message || "同步失败";
    toast.add({ title: msg, color: "error" });
  } finally {
    syncing.value = null;
  }
}

function formatDate(date: string | null) {
  if (!date) return "从未同步";
  return new Date(date).toLocaleString("zh-CN");
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-bold">
          组织管理
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          共 {{ total }} 个组织
        </p>
      </div>
    </div>

    <div
      v-if="status === 'pending'"
      class="flex justify-center py-12"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-6 h-6 animate-spin text-gray-400"
      />
    </div>

    <div
      v-else
      class="space-y-3"
    >
      <UCard
        v-for="org in orgs"
        :key="org.id"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <UAvatar
              :src="org.avatar_url || undefined"
              :alt="org.name"
              size="md"
            />
            <div>
              <NuxtLink
                :to="`/-/admin/orgs/${org.id}`"
                class="font-semibold hover:text-primary-500 transition-colors"
              >
                {{ org.full_name || org.name }}
              </NuxtLink>
              <div
                class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-0.5"
              >
                <span class="flex items-center gap-1">
                  <UIcon
                    name="i-lucide-users"
                    class="w-3.5 h-3.5"
                  />
                  {{ org.teamCount }} 个团队
                </span>
                <span class="flex items-center gap-1">
                  <UIcon
                    name="i-lucide-user"
                    class="w-3.5 h-3.5"
                  />
                  {{ org.member_count }} 名成员
                </span>
                <span class="flex items-center gap-1">
                  <UIcon
                    name="i-lucide-refresh-cw"
                    class="w-3.5 h-3.5"
                  />
                  {{ formatDate(org.synced_at) }}
                </span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <UButton
              size="sm"
              color="neutral"
              variant="soft"
              icon="i-lucide-refresh-cw"
              :loading="syncing === org.id"
              @click="syncOrg(org)"
            >
              同步
            </UButton>
            <UButton
              size="sm"
              color="neutral"
              variant="ghost"
              icon="i-lucide-chevron-right"
              :to="`/-/admin/orgs/${org.id}`"
            />
          </div>
        </div>
      </UCard>

      <div
        v-if="orgs.length === 0"
        class="text-center py-12 text-gray-400"
      >
        <UIcon
          name="i-lucide-building-2"
          class="w-12 h-12 mx-auto mb-3"
        />
        <p>暂无组织数据</p>
        <p class="text-sm mt-1">
          用户登录后将自动同步 Gitea 组织
        </p>
      </div>
    </div>
  </div>
</template>
