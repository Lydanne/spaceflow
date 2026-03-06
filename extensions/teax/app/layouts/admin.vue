<script setup lang="ts">
const route = useRoute();

const navItems = [
  {
    label: "用户管理",
    icon: "i-lucide-users",
    to: "/-/admin/users",
  },
  {
    label: "组织管理",
    icon: "i-lucide-building-2",
    to: "/-/admin/orgs",
  },
  {
    label: "审计日志",
    icon: "i-lucide-scroll-text",
    to: "/-/admin/audit-logs",
  },
  {
    label: "系统设置",
    icon: "i-lucide-settings",
    to: "/-/admin/settings",
  },
];

const isActive = (path: string) => route.path.startsWith(path);
</script>

<template>
  <div class="flex min-h-[calc(100vh-theme(spacing.16))]">
    <aside
      class="w-56 border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 p-4 shrink-0"
    >
      <h2
        class="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3 px-2"
      >
        系统管理
      </h2>
      <nav class="space-y-1">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
          :class="
            isActive(item.to)
              ? 'bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400 font-medium'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          "
        >
          <UIcon
            :name="item.icon"
            class="w-4 h-4 shrink-0"
          />
          {{ item.label }}
        </NuxtLink>
      </nav>
    </aside>
    <main class="flex-1 p-6">
      <slot />
    </main>
  </div>
</template>
