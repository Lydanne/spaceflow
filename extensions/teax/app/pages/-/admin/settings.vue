<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: "admin",
});

interface FeishuStatus {
  configured: boolean;
  connected: boolean;
  error: string | null;
  features: {
    encrypt: boolean;
    approval: boolean;
  };
}

const { data: statusData, refresh, status: fetchStatus } = await useFetch<{
  data: FeishuStatus;
}>("/api/admin/feishu-status", { key: "admin-feishu-status" });

const feishu = computed(() => statusData.value?.data ?? null);
const loading = computed(() => fetchStatus.value === "pending");

const config = useRuntimeConfig();
const webhookUrl = computed(() => {
  const base = config.public.appUrl || window.location.origin;
  return `${base}/api/webhooks/feishu`;
});

const copied = ref(false);
function copyWebhookUrl() {
  navigator.clipboard.writeText(webhookUrl.value);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
}
</script>

<template>
  <div>
    <h1 class="text-xl font-bold mb-6">
      系统设置
    </h1>

    <!-- 飞书连接状态 -->
    <UCard class="mb-6">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <UIcon
              name="i-simple-icons-lark"
              class="w-4 h-4"
            />
            <h3 class="font-semibold">
              飞书集成状态
            </h3>
          </div>
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            size="xs"
            :loading="loading"
            @click="refresh()"
          />
        </div>
      </template>

      <div
        v-if="feishu"
        class="space-y-4"
      >
        <!-- 连接状态 -->
        <div class="flex items-center gap-3">
          <div
            class="w-3 h-3 rounded-full"
            :class="feishu.connected ? 'bg-green-500' : feishu.configured ? 'bg-yellow-500' : 'bg-red-500'"
          />
          <div>
            <p class="font-medium text-sm">
              {{ feishu.connected ? '已连接' : feishu.configured ? '已配置但连接失败' : '未配置' }}
            </p>
            <p
              v-if="feishu.error"
              class="text-xs text-red-500 mt-0.5"
            >
              {{ feishu.error }}
            </p>
          </div>
        </div>

        <!-- 功能状态 -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div class="flex items-center gap-1.5">
            <UIcon
              :name="feishu.configured ? 'i-lucide-check-circle' : 'i-lucide-x-circle'"
              :class="feishu.configured ? 'text-green-500' : 'text-gray-400'"
              class="w-4 h-4"
            />
            <span>应用凭证</span>
          </div>
          <div class="flex items-center gap-1.5">
            <UIcon
              :name="feishu.connected ? 'i-lucide-check-circle' : 'i-lucide-x-circle'"
              :class="feishu.connected ? 'text-green-500' : 'text-gray-400'"
              class="w-4 h-4"
            />
            <span>Token 有效</span>
          </div>
          <div class="flex items-center gap-1.5">
            <UIcon
              :name="feishu.features.encrypt ? 'i-lucide-check-circle' : 'i-lucide-minus-circle'"
              :class="feishu.features.encrypt ? 'text-green-500' : 'text-gray-400'"
              class="w-4 h-4"
            />
            <span>事件加密</span>
          </div>
          <div class="flex items-center gap-1.5">
            <UIcon
              :name="feishu.features.approval ? 'i-lucide-check-circle' : 'i-lucide-minus-circle'"
              :class="feishu.features.approval ? 'text-green-500' : 'text-gray-400'"
              class="w-4 h-4"
            />
            <span>审批流程</span>
          </div>
        </div>

        <!-- Webhook URL -->
        <div>
          <label class="block text-sm font-medium mb-1">
            飞书事件回调地址
          </label>
          <div class="flex gap-2">
            <UInput
              :model-value="webhookUrl"
              readonly
              size="sm"
              class="flex-1 font-mono text-xs"
            />
            <UButton
              :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
              color="neutral"
              variant="soft"
              size="sm"
              @click="copyWebhookUrl"
            />
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            将此地址填入飞书开放平台 → 事件订阅 → 请求地址
          </p>
        </div>
      </div>
    </UCard>
  </div>
</template>
