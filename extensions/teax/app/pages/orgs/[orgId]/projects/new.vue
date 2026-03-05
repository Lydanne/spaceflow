<script setup lang="ts">
const route = useRoute();
const router = useRouter();
const toast = useToast();
const orgId = route.params.orgId as string;

interface RepoItem {
  id: number;
  name: string;
  full_name: string;
  description: string;
  default_branch: string;
  updated_at: string;
}

const searchQuery = ref("");
const debouncedQuery = ref("");
const selectedRepo = ref<RepoItem | null>(null);
const creating = ref(false);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debouncedQuery.value = val;
  }, 300);
});

const { data: reposData, status: reposStatus } = await useFetch<{
  data: RepoItem[];
}>(`/api/orgs/${orgId}/repos`, { query: { q: debouncedQuery, limit: 20 } });

const repos = computed(() => reposData.value?.data ?? []);

function selectRepo(repo: RepoItem) {
  selectedRepo.value = repo;
}

async function createProject() {
  if (!selectedRepo.value) return;
  creating.value = true;
  try {
    const project = await $fetch(`/api/orgs/${orgId}/projects`, {
      method: "POST",
      body: { repoFullName: selectedRepo.value.full_name },
    });
    toast.add({
      title: `项目 ${selectedRepo.value.full_name} 创建成功`,
      color: "success",
    });
    router.push(`/orgs/${orgId}/projects/${(project as { id: string }).id}`);
  } catch (err: unknown) {
    const msg
      = (err as { data?: { message?: string } })?.data?.message || "创建失败";
    toast.add({ title: msg, color: "error" });
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-8">
    <div class="flex items-center gap-3 mb-6">
      <UButton
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        size="sm"
        :to="`/orgs/${orgId}/projects`"
      />
      <h1 class="text-xl font-bold">
        创建项目
      </h1>
    </div>

    <UCard>
      <div class="space-y-6">
        <div>
          <label class="block text-sm font-medium mb-2">
            搜索 Gitea 仓库
          </label>
          <UInput
            v-model="searchQuery"
            placeholder="输入仓库名搜索..."
            icon="i-lucide-search"
            size="lg"
          />
        </div>

        <div>
          <label class="block text-sm font-medium mb-2"> 可用仓库 </label>

          <div
            v-if="reposStatus === 'pending'"
            class="flex justify-center py-6"
          >
            <UIcon
              name="i-lucide-loader-2"
              class="w-5 h-5 animate-spin text-gray-400"
            />
          </div>

          <div
            v-else-if="repos.length > 0"
            class="space-y-2 max-h-80 overflow-y-auto"
          >
            <button
              v-for="repo in repos"
              :key="repo.id"
              class="w-full text-left p-3 rounded-lg border transition-colors"
              :class="
                selectedRepo?.id === repo.id
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
                  : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900'
              "
              @click="selectRepo(repo)"
            >
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium text-sm">
                    {{ repo.full_name }}
                  </p>
                  <p
                    v-if="repo.description"
                    class="text-xs text-gray-500 dark:text-gray-400 mt-0.5"
                  >
                    {{ repo.description }}
                  </p>
                </div>
                <UBadge
                  color="neutral"
                  variant="subtle"
                  size="sm"
                >
                  {{ repo.default_branch }}
                </UBadge>
              </div>
            </button>
          </div>

          <div
            v-else
            class="text-center py-6 text-gray-400 text-sm"
          >
            未找到可用仓库
          </div>
        </div>

        <div
          v-if="selectedRepo"
          class="bg-primary-50 dark:bg-primary-950 rounded-lg p-4"
        >
          <p class="text-sm font-medium">
            已选择仓库
          </p>
          <p class="text-lg font-semibold mt-1">
            {{ selectedRepo.full_name }}
          </p>
          <p
            v-if="selectedRepo.description"
            class="text-sm text-gray-500 mt-0.5"
          >
            {{ selectedRepo.description }}
          </p>
        </div>

        <div class="flex justify-end gap-3">
          <UButton
            color="neutral"
            variant="soft"
            :to="`/orgs/${orgId}/projects`"
          >
            取消
          </UButton>
          <UButton
            color="primary"
            :disabled="!selectedRepo"
            :loading="creating"
            @click="createProject"
          >
            创建项目
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
