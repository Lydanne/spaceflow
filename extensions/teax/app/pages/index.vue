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

const { data: repoCountData } = await useFetch<{ count: number }>(
  "/api/stats/repo-count",
  { key: "home-repo-count" },
);
const repoCount = computed(() => repoCountData.value?.count ?? 0);

interface CommitItem {
  sha: string;
  message: string;
  authorName: string;
  authorEmail: string;
  date: string;
  htmlUrl: string;
  projectName: string;
  projectFullName: string;
}

const { data: commitsData } = await useFetch<{ data: CommitItem[] }>(
  "/api/stats/recent-commits",
  { key: "home-recent-commits" },
);
const recentCommits = computed(() => commitsData.value?.data ?? []);

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}
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
            仓库总数
          </p>
          <p class="text-3xl font-bold mt-1">
            {{ repoCount }}
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
          :to="`/${org.name}`"
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

    <div class="mt-8">
      <h2 class="text-lg font-semibold mb-4">
        最近提交
      </h2>
      <UCard v-if="recentCommits.length > 0">
        <div class="divide-y divide-gray-200 dark:divide-gray-800">
          <div
            v-for="commit in recentCommits"
            :key="commit.sha"
            class="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
          >
            <UIcon
              name="i-lucide-git-commit-horizontal"
              class="w-5 h-5 mt-0.5 text-gray-400 shrink-0"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <a
                  :href="commit.htmlUrl"
                  target="_blank"
                  class="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline truncate"
                >
                  {{ commit.message }}
                </a>
              </div>
              <div class="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                <span class="font-mono">{{ commit.sha.slice(0, 7) }}</span>
                <span>·</span>
                <span>{{ commit.projectFullName }}</span>
                <span>·</span>
                <span>{{ commit.authorName }}</span>
                <span>·</span>
                <span>{{ timeAgo(commit.date) }}</span>
              </div>
            </div>
          </div>
        </div>
      </UCard>
      <UCard v-else>
        <div class="text-center py-6 text-gray-400">
          <UIcon
            name="i-lucide-git-commit-horizontal"
            class="w-10 h-10 mx-auto mb-2"
          />
          <p class="text-sm">
            暂无最近提交
          </p>
        </div>
      </UCard>
    </div>
  </div>
</template>
