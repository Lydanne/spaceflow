<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: "admin",
});

interface AuditLogItem {
  id: number;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
  username: string | null;
  userAvatar: string | null;
  orgName: string | null;
}

const page = ref(1);
const limit = 30;

const { data, status } = await useFetch<{
  data: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
}>("/api/admin/audit-logs", {
  query: { page, limit },
});

const logs = computed(() => data.value?.data ?? []);
const total = computed(() => data.value?.total ?? 0);
const totalPages = computed(() => Math.ceil(total.value / limit));

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    "project.create": "创建项目",
    "project.delete": "删除项目",
    "project.settings": "修改项目设置",
    "permission_group.create": "创建权限组",
    "permission_group.update": "更新权限组",
    "permission_group.delete": "删除权限组",
    "team.sync": "同步团队",
  };
  return map[action] || action;
}

function actionColor(action: string): string {
  if (action.includes("delete")) return "error";
  if (action.includes("create")) return "success";
  if (action.includes("update") || action.includes("settings")) return "warning";
  return "info";
}
</script>

<template>
  <div>
    <h1 class="text-xl font-bold mb-6">
      审计日志
    </h1>

    <div
      v-if="status === 'pending'"
      class="flex justify-center py-12"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-6 h-6 animate-spin text-gray-400"
      />
    </div>

    <template v-else>
      <div
        v-if="logs.length > 0"
        class="space-y-2"
      >
        <UCard
          v-for="log in logs"
          :key="log.id"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <UAvatar
                :src="log.userAvatar || undefined"
                :alt="log.username || 'unknown'"
                size="sm"
              />
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-medium text-sm">
                    {{ log.username || "系统" }}
                  </span>
                  <UBadge
                    :color="(actionColor(log.action) as any)"
                    variant="subtle"
                    size="sm"
                  >
                    {{ actionLabel(log.action) }}
                  </UBadge>
                  <span
                    v-if="log.orgName"
                    class="text-xs text-gray-500"
                  >
                    @ {{ log.orgName }}
                  </span>
                </div>
                <div class="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                  <span v-if="log.resource_type">
                    {{ log.resource_type }}{{ log.resource_id ? `: ${log.resource_id.substring(0, 8)}` : "" }}
                  </span>
                  <span v-if="log.ip_address">
                    IP: {{ log.ip_address }}
                  </span>
                  <span v-if="log.detail && Object.keys(log.detail).length > 0">
                    {{ JSON.stringify(log.detail) }}
                  </span>
                </div>
              </div>
            </div>
            <span class="text-xs text-gray-400 shrink-0">
              {{ new Date(log.created_at).toLocaleString("zh-CN") }}
            </span>
          </div>
        </UCard>

        <div
          v-if="totalPages > 1"
          class="flex justify-center pt-4"
        >
          <UPagination
            v-model="page"
            :total="total"
            :items-per-page="limit"
          />
        </div>
      </div>

      <UCard v-else>
        <div class="text-center py-12 text-gray-400">
          <UIcon
            name="i-lucide-scroll-text"
            class="w-12 h-12 mx-auto mb-3"
          />
          <p>
            暂无审计日志
          </p>
        </div>
      </UCard>
    </template>
  </div>
</template>
