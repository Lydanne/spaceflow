<script setup lang="ts">
definePageMeta({
  layout: false,
});

const config = useRuntimeConfig();
const route = useRoute();
const { fetch: refreshSession } = useUserSession();

const token = computed(() => route.query.token as string);
const selecting = ref(false);
const error = ref<string | null>(null);

interface SelectableUser {
  id: string;
  gitea_username: string;
  email: string;
  avatar_url: string | null;
}

interface SelectData {
  feishu_name: string;
  feishu_avatar: string;
  users: SelectableUser[];
}

const { data, status } = await useFetch<SelectData>("/api/auth/feishu-select", {
  query: { token },
});

async function selectAccount(userId: string) {
  if (selecting.value) return;
  selecting.value = true;
  error.value = null;

  try {
    await $fetch("/api/auth/feishu-select", {
      method: "POST",
      body: {
        token: token.value,
        user_id: userId,
      },
    });
    // 刷新 session 状态后跳转首页
    await refreshSession();
    await navigateTo("/");
  } catch (err: unknown) {
    error.value = "登录失败，请重试";
    selecting.value = false;
  }
}

function backToLogin() {
  navigateTo("/auth/login");
}
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950"
  >
    <div class="w-full max-w-md mx-auto">
      <div class="text-center mb-8">
        <div
          class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-500 text-white mb-4"
        >
          <UIcon
            name="i-lucide-box"
            class="w-8 h-8"
          />
        </div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ config.public.appName }}
        </h1>
        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
          选择要登录的账户
        </p>
      </div>

      <!-- Loading -->
      <div
        v-if="status === 'pending' || status === 'idle'"
        class="flex justify-center py-8"
      >
        <UIcon
          name="i-lucide-loader-2"
          class="w-8 h-8 animate-spin text-primary-500"
        />
      </div>

      <!-- Error: Invalid token -->
      <UCard v-else-if="status === 'error'">
        <div class="text-center py-4">
          <UIcon
            name="i-lucide-alert-circle"
            class="w-12 h-12 text-red-500 mx-auto mb-4"
          />
          <p class="text-gray-600 dark:text-gray-400 mb-4">
            链接已失效或过期，请重新登录
          </p>
          <UButton
            color="primary"
            @click="backToLogin"
          >
            返回登录
          </UButton>
        </div>
      </UCard>

      <!-- Account selection -->
      <UCard v-else-if="data">
        <template #header>
          <div class="flex items-center gap-3">
            <UAvatar
              :src="data.feishu_avatar"
              :alt="data.feishu_name"
              size="md"
            />
            <div>
              <p class="font-medium text-gray-900 dark:text-white">
                {{ data.feishu_name }}
              </p>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                飞书账号已绑定 {{ data.users.length }} 个账户
              </p>
            </div>
          </div>
        </template>

        <UAlert
          v-if="error"
          color="error"
          icon="i-lucide-alert-circle"
          :description="error"
          class="mb-4"
        />

        <div class="space-y-2">
          <button
            v-for="user in data.users"
            :key="user.id"
            :disabled="selecting"
            class="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            @click="selectAccount(user.id)"
          >
            <UAvatar
              :src="user.avatar_url || undefined"
              :alt="user.gitea_username"
              size="md"
            />
            <div class="flex-1 text-left">
              <p class="font-medium text-gray-900 dark:text-white">
                {{ user.gitea_username }}
              </p>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ user.email }}
              </p>
            </div>
            <UIcon
              name="i-lucide-chevron-right"
              class="w-5 h-5 text-gray-400"
            />
          </button>
        </div>

        <template #footer>
          <div class="text-center">
            <UButton
              variant="ghost"
              color="neutral"
              @click="backToLogin"
            >
              使用其他方式登录
            </UButton>
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>
