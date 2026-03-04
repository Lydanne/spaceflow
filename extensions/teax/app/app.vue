<script setup lang="ts">
const config = useRuntimeConfig()
const { loggedIn, user, clear } = useUserSession()

useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  htmlAttrs: {
    lang: 'zh-CN'
  }
})

useSeoMeta({
  title: config.public.appName,
  description: 'Gitea 功能扩展平台'
})

async function logout() {
  await clear()
  navigateTo('/auth/login')
}
</script>

<template>
  <UApp>
    <UHeader v-if="loggedIn">
      <template #left>
        <NuxtLink
          to="/"
          class="flex items-center gap-2"
        >
          <UIcon
            name="i-lucide-box"
            class="w-6 h-6 text-primary-500"
          />
          <span class="font-bold text-lg">{{ config.public.appName }}</span>
        </NuxtLink>
      </template>

      <template #right>
        <UColorModeButton />

        <UDropdownMenu
          :items="[
            [
              {
                label: user?.username || '',
                type: 'label' as const
              }
            ],
            [
              {
                label: '退出登录',
                icon: 'i-lucide-log-out',
                onSelect: logout
              }
            ]
          ]"
        >
          <UButton
            :label="user?.username"
            color="neutral"
            variant="ghost"
            icon="i-lucide-user"
          />
        </UDropdownMenu>
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>

    <UFooter v-if="loggedIn">
      <template #left>
        <p class="text-sm text-muted">
          {{ config.public.appName }} • © {{ new Date().getFullYear() }}
        </p>
      </template>
    </UFooter>
  </UApp>
</template>
