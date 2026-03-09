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

interface SystemWebhook {
  id: number;
  type: string;
  url: string;
  active: boolean;
  events: string[];
  config: {
    url: string;
    content_type: string;
    secret: string;
  };
}

const toast = useToast();

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

const giteaWebhookUrl = computed(() => {
  const base = config.public.appUrl || window.location.origin;
  return `${base}/api/webhooks/gitea`;
});

const copied = ref(false);
function copyWebhookUrl() {
  navigator.clipboard.writeText(webhookUrl.value);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
}

const copiedGitea = ref(false);
function copyGiteaWebhookUrl() {
  navigator.clipboard.writeText(giteaWebhookUrl.value);
  copiedGitea.value = true;
  setTimeout(() => {
    copiedGitea.value = false;
  }, 2000);
}

// Gitea Webhook 管理
interface WebhookStatus {
  exists: boolean;
  active: boolean;
  events?: string[];
  url?: string;
  webhookId?: number;
  message?: string;
}

const webhookStatus = ref<WebhookStatus | null>(null);
const loadingWebhook = ref(false);

async function checkWebhookStatus() {
  loadingWebhook.value = true;
  try {
    const hooks = await $fetch<SystemWebhook[]>("/api/admin/webhooks");
    if (hooks.length > 0) {
      const hook = hooks[0];
      webhookStatus.value = {
        exists: true,
        active: hook.active,
        events: hook.events,
        url: hook.config.url,
        webhookId: hook.id,
      };
    } else {
      webhookStatus.value = {
        exists: false,
        active: false,
        message: "未配置系统 Webhook",
      };
    }
  } catch (err: unknown) {
    toast.add({
      title: "获取 Webhook 状态失败",
      color: "error",
    });
  } finally {
    loadingWebhook.value = false;
  }
}

function openGiteaWebhooks() {
  window.open("https://git.bjxgj.com/-/admin/hooks", "_blank");
}

onMounted(() => {
  checkWebhookStatus();
});
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
              name="i-simple-icons-bytedance"
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

    <!-- Gitea Webhook 配置 -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <UIcon
              name="i-lucide-webhook"
              class="w-4 h-4"
            />
            <h3 class="font-semibold">
              Gitea Webhook 管理
            </h3>
          </div>
          <UButton
            icon="i-lucide-refresh-cw"
            size="xs"
            variant="ghost"
            :loading="loadingWebhook"
            @click="checkWebhookStatus"
          >
            刷新状态
          </UButton>
        </div>
      </template>

      <div class="space-y-4">
        <!-- 说明 -->
        <div class="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1">
              <p class="text-sm text-blue-700 dark:text-blue-300 mb-1">
                系统级 Webhook 将自动应用到 Gitea 中的所有仓库，接收所有事件通知
              </p>
              <p class="text-xs text-blue-600 dark:text-blue-400">
                当前 Gitea 版本不支持通过 API 创建系统钩子，请在 Gitea 管理页面中手动创建
              </p>
            </div>
            <UButton
              size="xs"
              color="primary"
              variant="soft"
              @click="openGiteaWebhooks"
            >
              前往 Gitea
            </UButton>
          </div>
        </div>

        <!-- Webhook URL -->
        <div>
          <label class="block text-sm font-medium mb-1">
            Webhook 回调地址
          </label>
          <div class="flex gap-2">
            <UInput
              :model-value="giteaWebhookUrl"
              readonly
              size="sm"
              class="flex-1 font-mono text-xs"
            />
            <UButton
              :icon="copiedGitea ? 'i-lucide-check' : 'i-lucide-copy'"
              color="neutral"
              variant="soft"
              size="sm"
              @click="copyGiteaWebhookUrl"
            />
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            在 Gitea 中创建系统 Webhook 时使用此地址
          </p>
        </div>

        <!-- Webhook 状态 -->
        <div
          v-if="loadingWebhook"
          class="text-center py-8 text-gray-400"
        >
          <UIcon
            name="i-lucide-loader-2"
            class="w-8 h-8 mx-auto mb-2 animate-spin"
          />
          <p>正在检查 Webhook 状态...</p>
        </div>

        <div
          v-else-if="webhookStatus"
          class="space-y-3"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <div
                  :class="[
                    'w-2 h-2 rounded-full',
                    webhookStatus.exists
                      ? (webhookStatus.active ? 'bg-green-500' : 'bg-yellow-500')
                      : 'bg-gray-400',
                  ]"
                />
                <span class="text-sm font-medium">
                  {{
                    webhookStatus.exists
                      ? (webhookStatus.active ? '运行中' : '已暂停')
                      : '未配置'
                  }}
                </span>
                <span
                  v-if="webhookStatus.exists && webhookStatus.events"
                  class="text-xs text-gray-400"
                >
                  {{ webhookStatus.events.length }} 个事件
                </span>
              </div>
              <p
                v-if="webhookStatus.message"
                class="text-xs text-gray-500"
              >
                {{ webhookStatus.message }}
              </p>
              <p
                v-else
                class="text-xs text-gray-500"
              >
                接收 Gitea 所有仓库的事件通知，包括 Actions、代码推送等
              </p>
            </div>

          </div>

          <details
            v-if="webhookStatus.exists"
            class="group"
          >
            <summary class="text-xs text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none">
              <span class="inline-flex items-center gap-1">
                详细信息
              </span>
            </summary>
            <div class="mt-2 pl-4 space-y-1.5 text-xs text-gray-500">
              <div
                v-if="webhookStatus.url"
                class="font-mono break-all"
              >
                {{ webhookStatus.url }}
              </div>
              <div
                v-if="webhookStatus.webhookId"
                class="font-mono"
              >
                ID: {{ webhookStatus.webhookId }}
              </div>
              <div
                v-if="webhookStatus.events"
                class="flex flex-wrap gap-1 pt-1"
              >
                <span
                  v-for="event in webhookStatus.events"
                  :key="event"
                  class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-mono"
                >
                  {{ event }}
                </span>
              </div>
            </div>
          </details>
        </div>
      </div>
    </UCard>
  </div>
</template>
