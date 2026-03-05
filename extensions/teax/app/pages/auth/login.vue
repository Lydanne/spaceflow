<script setup lang="ts">
definePageMeta({
  layout: false,
});

const config = useRuntimeConfig();
const route = useRoute();

const error = computed(() => {
  const err = route.query.error as string | undefined;
  if (err === "feishu_not_bound") {
    return "飞书账号未绑定 Gitea 账号，请先使用 Gitea 登录后在设置中绑定飞书";
  }
  return null;
});

function loginWithGitea() {
  navigateTo("/api/auth/gitea", { external: true });
}

function loginWithFeishu() {
  navigateTo("/api/auth/feishu", { external: true });
}
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950"
  >
    <div class="w-full max-w-sm mx-auto">
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
          Gitea 功能扩展平台
        </p>
      </div>

      <UAlert
        v-if="error"
        color="error"
        icon="i-lucide-alert-circle"
        :description="error"
        class="mb-4"
      />

      <UCard>
        <div class="space-y-4">
          <UButton
            block
            size="lg"
            icon="i-simple-icons-gitea"
            color="primary"
            @click="loginWithGitea"
          >
            使用 Gitea 登录
          </UButton>

          <USeparator label="或" />

          <UButton
            block
            size="lg"
            icon="i-lucide-message-square"
            color="neutral"
            variant="outline"
            @click="loginWithFeishu"
          >
            使用飞书登录
          </UButton>

          <p class="text-xs text-center text-gray-400 dark:text-gray-500">
            飞书登录需先关联 Gitea 账号
          </p>
        </div>
      </UCard>
    </div>
  </div>
</template>
