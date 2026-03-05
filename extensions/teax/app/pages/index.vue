<script setup lang="ts">
const { user } = useUserSession();

interface OrgItem {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  projectCount: number;
}

const { data: orgsData, status } = await useFetch<{ data: OrgItem[] }>(
  "/api/orgs",
  { key: "home-orgs" },
);
const orgs = computed(() => orgsData.value?.data ?? []);
const totalProjects = computed(() =>
  orgs.value.reduce((sum, o) => sum + Number(o.projectCount || 0), 0),
);

const { data: todayStats } = await useFetch<{ count: number }>(
  "/api/stats/today-publishes",
  { key: "home-today-publishes" },
);
const todayPublishes = computed(() => todayStats.value?.count ?? 0);
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold mb-6">
      欢迎回来, {{ user?.username }}
    </h1>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <UCard>
        <div class="text-center">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            组织数
          </p>
          <p class="text-3xl font-bold mt-1">
            {{ orgs.length }}
          </p>
        </div>
      </UCard>
      <UCard>
        <div class="text-center">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            项目总数
          </p>
          <p class="text-3xl font-bold mt-1">
            {{ totalProjects }}
          </p>
        </div>
      </UCard>
      <UCard>
        <div class="text-center">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            今日构建
          </p>
          <p class="text-3xl font-bold mt-1">
            {{ todayPublishes }}
          </p>
        </div>
      </UCard>
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

    <div v-else>
      <h2 class="text-lg font-semibold mb-4">
        我的组织
      </h2>
      <div
        v-if="orgs.length > 0"
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <NuxtLink
          v-for="org in orgs"
          :key="org.id"
          :to="`/orgs/${org.id}/projects`"
          class="block"
        >
          <UCard class="hover:ring-1 hover:ring-primary-500 transition-all">
            <div class="flex items-center gap-3">
              <UAvatar
                :src="org.avatarUrl || undefined"
                :alt="org.name"
                size="lg"
              />
              <div>
                <p class="font-semibold">
                  {{ org.displayName || org.name }}
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ org.projectCount || 0 }} 个项目
                </p>
              </div>
            </div>
          </UCard>
        </NuxtLink>
      </div>

      <UCard v-else>
        <div class="text-center py-8 text-gray-400">
          <UIcon
            name="i-lucide-building-2"
            class="w-12 h-12 mx-auto mb-3"
          />
          <p>暂无组织</p>
          <p class="text-sm mt-1">
            登录后将自动同步 Gitea 组织
          </p>
        </div>
      </UCard>
    </div>
  </div>
</template>
