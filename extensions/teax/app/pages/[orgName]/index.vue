<script setup lang="ts">
const route = useRoute();
const orgName = route.params.orgName as string;

const { data: org, status: orgStatus } = await useFetch<{
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
}>(`/api/resolve/${orgName}`);

const orgId = computed(() => org.value?.id ?? "");

const { isOwnerOrAdmin } = useOrgRole(orgId.value);

interface ProjectItem {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  defaultBranch: string | null;
  updatedAt: string;
}

const page = ref(1);
const limit = 20;

const { data, status } = await useFetch<{
  data: ProjectItem[];
  total: number;
}>(() => `/api/orgs/${orgId.value}/projects`, {
  query: { page, limit },
  watch: false,
});

const projects = computed(() => data.value?.data ?? []);
const total = computed(() => data.value?.total ?? 0);
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-8">
    <div
      v-if="orgStatus === 'pending'"
      class="flex justify-center py-12"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-6 h-6 animate-spin text-gray-400"
      />
    </div>

    <template v-else-if="org">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            size="sm"
            to="/"
          />
          <div>
            <h1 class="text-xl font-bold">
              项目列表
            </h1>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              共 {{ total }} 个项目
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            v-if="isOwnerOrAdmin"
            icon="i-lucide-settings"
            color="neutral"
            variant="soft"
            :to="`/org/${orgName}/settings`"
          >
            组织设置
          </UButton>
          <UButton
            icon="i-lucide-plus"
            color="primary"
            :to="`/org/${orgName}/new`"
          >
            创建项目
          </UButton>
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

      <div v-else>
        <div
          v-if="projects.length > 0"
          class="space-y-3"
        >
          <NuxtLink
            v-for="project in projects"
            :key="project.id"
            :to="`/${project.fullName}`"
            class="block"
          >
            <UCard class="hover:ring-1 hover:ring-primary-500 transition-all">
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-semibold">
                    {{ project.fullName }}
                  </p>
                  <p
                    v-if="project.description"
                    class="text-sm text-gray-500 dark:text-gray-400 mt-0.5"
                  >
                    {{ project.description }}
                  </p>
                  <div class="flex items-center gap-3 mt-2">
                    <UBadge
                      color="neutral"
                      variant="subtle"
                      size="sm"
                    >
                      <UIcon
                        name="i-lucide-git-branch"
                        class="w-3 h-3 mr-1"
                      />
                      {{ project.defaultBranch || "main" }}
                    </UBadge>
                    <span class="text-xs text-gray-400">
                      更新于
                      {{
                        new Date(project.updatedAt).toLocaleDateString("zh-CN")
                      }}
                    </span>
                  </div>
                </div>
                <UIcon
                  name="i-lucide-chevron-right"
                  class="w-5 h-5 text-gray-400"
                />
              </div>
            </UCard>
          </NuxtLink>
        </div>

        <UCard v-else>
          <div class="text-center py-12 text-gray-400">
            <UIcon
              name="i-lucide-folder-open"
              class="w-12 h-12 mx-auto mb-3"
            />
            <p>暂无项目</p>
            <p class="text-sm mt-1">
              点击右上角「创建项目」关联 Gitea 仓库
            </p>
          </div>
        </UCard>

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
      </div>
    </template>
  </div>
</template>
