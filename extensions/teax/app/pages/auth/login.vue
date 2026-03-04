<script setup lang="ts">
definePageMeta({
  layout: false
})

const config = useRuntimeConfig()

function loginWithGitea() {
  navigateTo('/api/auth/gitea', { external: true })
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
    <div class="w-full max-w-sm mx-auto">
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-500 text-white mb-4">
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
            disabled
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
