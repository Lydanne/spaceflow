<script setup lang="ts">
const config = useRuntimeConfig();
const { loggedIn, user, clear } = useUserSession();

useHead({
  meta: [{ name: "viewport", content: "width=device-width, initial-scale=1" }],
  link: [{ rel: "icon", href: "/favicon.ico" }],
  htmlAttrs: {
    lang: "zh-CN",
  },
});

useSeoMeta({
  title: config.public.appName,
  description: "Gitea 功能扩展平台",
});

const userMenuItems = computed(() => {
  const items: unknown[][] = [
    [{ label: user.value?.username || "", type: "label" as const }],
  ];
  if (user.value?.isAdmin) {
    items.push([
      {
        label: "系统管理",
        icon: "i-lucide-shield",
        onSelect: () => navigateTo("/-/admin/users"),
      },
    ]);
  }
  items.push([
    {
      label: "退出登录",
      icon: "i-lucide-log-out",
      onSelect: logout,
    },
  ]);
  return items;
});

async function logout() {
  await $fetch("/api/auth/logout", { method: "POST" });
  await clear();
  navigateTo("/auth/login");
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

        <UDropdownMenu :items="userMenuItems">
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
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
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
