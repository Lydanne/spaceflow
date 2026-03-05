<script setup lang="ts">
interface RepoInfo {
  fullName: string;
  description: string | null;
  defaultBranch: string | null;
  cloneUrl: string | null;
  createdAt: string | null;
  htmlUrl: string;
  stars: number;
  forks: number;
  language: string | null;
}

const props = defineProps<{
  orgId: string;
  projectId: string;
}>();

const { data, status } = useLazyFetch<{
  content: string | null;
  source: string | null;
  repoInfo: RepoInfo | null;
}>(
  `/api/orgs/${props.orgId}/projects/${props.projectId}/readme`,
);

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
</script>

<template>
  <div>
    <ProjectTabSkeleton v-if="status === 'pending'" />

    <template v-else-if="data?.content">
      <div class="flex items-center gap-2 mb-4 text-sm text-gray-500 dark:text-gray-400">
        <UIcon
          name="i-lucide-file-text"
          class="w-4 h-4"
        />
        <span>{{ data.source }}</span>
      </div>
      <UCard>
        <div class="prose prose-sm dark:prose-invert max-w-none">
          <MDC
            :value="data.content"
            tag="article"
          />
        </div>
      </UCard>
    </template>

    <template v-else-if="data?.repoInfo">
      <UCard>
        <div class="space-y-5">
          <div class="flex items-start justify-between">
            <div>
              <h3 class="text-lg font-semibold">
                {{ data.repoInfo.fullName }}
              </h3>
              <p
                v-if="data.repoInfo.description"
                class="text-sm text-gray-500 dark:text-gray-400 mt-1"
              >
                {{ data.repoInfo.description }}
              </p>
            </div>
            <a
              v-if="data.repoInfo.htmlUrl"
              :href="data.repoInfo.htmlUrl"
              target="_blank"
              class="shrink-0"
            >
              <UButton
                icon="i-lucide-external-link"
                color="neutral"
                variant="ghost"
                size="sm"
              />
            </a>
          </div>

          <div class="flex flex-wrap gap-3">
            <UBadge
              v-if="data.repoInfo.language"
              color="primary"
              variant="subtle"
              size="sm"
            >
              <UIcon
                name="i-lucide-code-2"
                class="w-3 h-3 mr-1"
              />
              {{ data.repoInfo.language }}
            </UBadge>
            <UBadge
              v-if="data.repoInfo.defaultBranch"
              color="neutral"
              variant="subtle"
              size="sm"
            >
              <UIcon
                name="i-lucide-git-branch"
                class="w-3 h-3 mr-1"
              />
              {{ data.repoInfo.defaultBranch }}
            </UBadge>
            <UBadge
              color="neutral"
              variant="subtle"
              size="sm"
            >
              <UIcon
                name="i-lucide-star"
                class="w-3 h-3 mr-1"
              />
              {{ data.repoInfo.stars }}
            </UBadge>
            <UBadge
              color="neutral"
              variant="subtle"
              size="sm"
            >
              <UIcon
                name="i-lucide-git-fork"
                class="w-3 h-3 mr-1"
              />
              {{ data.repoInfo.forks }}
            </UBadge>
          </div>

          <div
            v-if="data.repoInfo.cloneUrl"
            class="flex items-center gap-2"
          >
            <UIcon
              name="i-lucide-terminal"
              class="w-4 h-4 text-gray-400 shrink-0"
            />
            <code class="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded flex-1 truncate">
              {{ data.repoInfo.cloneUrl }}
            </code>
          </div>

          <div class="flex items-center gap-2 text-xs text-gray-400">
            <UIcon
              name="i-lucide-calendar"
              class="w-3.5 h-3.5"
            />
            <span>创建于 {{ formatDate(data.repoInfo.createdAt) }}</span>
          </div>

          <div class="border-t border-gray-200 dark:border-gray-800 pt-4">
            <p class="text-sm text-gray-400">
              <UIcon
                name="i-lucide-info"
                class="w-4 h-4 inline-block mr-1 align-text-bottom"
              />
              在仓库根目录创建 <code class="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">TEAX.md</code>
              或 <code class="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">README.md</code> 即可替代此页面
            </p>
          </div>
        </div>
      </UCard>
    </template>

    <div
      v-else
      class="text-center py-12 text-gray-400"
    >
      <UIcon
        name="i-lucide-file-text"
        class="w-12 h-12 mx-auto mb-3"
      />
      <p>暂无仓库信息</p>
    </div>
  </div>
</template>
