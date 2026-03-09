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
    const hook = hooks[0];
    if (hook) {
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
  <div class="max-w-5xl">
    <!-- 页面标题 -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
        系统设置
      </h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        管理系统集成和 Webhook 配置
      </p>
    </div>

    <div class="space-y-6">
      <!-- 飞书集成 -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <UIcon
                  name="i-simple-icons-bytedance"
                  class="w-5 h-5 text-blue-600 dark:text-blue-400"
                />
              </div>
              <div>
                <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
                  飞书集成
                </h2>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  消息通知和审批流程
                </p>
              </div>
            </div>
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="ghost"
              size="sm"
              :loading="loading"
              @click="refresh()"
            />
          </div>
        </template>

        <div
          v-if="feishu"
          class="space-y-6"
        >
          <!-- 连接状态卡片 -->
          <div
            class="p-4 rounded-lg border transition-colors"
            :class="[
              feishu.connected
                ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                : feishu.configured
                  ? 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800'
                  : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800',
            ]"
          >
            <div class="flex items-start gap-3">
              <div
                class="mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0"
                :class="[
                  feishu.connected
                    ? 'bg-green-500'
                    : feishu.configured
                      ? 'bg-yellow-500'
                      : 'bg-gray-400',
                ]"
              />
              <div class="flex-1 min-w-0">
                <p
                  class="font-medium text-sm"
                  :class="[
                    feishu.connected
                      ? 'text-green-700 dark:text-green-300'
                      : feishu.configured
                        ? 'text-yellow-700 dark:text-yellow-300'
                        : 'text-gray-700 dark:text-gray-300',
                  ]"
                >
                  {{ feishu.connected ? '已连接' : feishu.configured ? '已配置但连接失败' : '未配置' }}
                </p>
                <p
                  v-if="feishu.error"
                  class="text-xs mt-1"
                  :class="[
                    feishu.connected
                      ? 'text-green-600 dark:text-green-400'
                      : feishu.configured
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-gray-600 dark:text-gray-400',
                  ]"
                >
                  {{ feishu.error }}
                </p>
              </div>
            </div>
          </div>

          <!-- 功能状态 -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              功能状态
            </h3>
            <div class="grid grid-cols-2 gap-3">
              <div
                class="flex items-center gap-2.5 p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50"
              >
                <UIcon
                  :name="feishu.configured ? 'i-lucide-check-circle-2' : 'i-lucide-circle-x'"
                  :class="feishu.configured ? 'text-green-500' : 'text-gray-400'"
                  class="w-5 h-5 flex-shrink-0"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">应用凭证</span>
              </div>
              <div
                class="flex items-center gap-2.5 p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50"
              >
                <UIcon
                  :name="feishu.connected ? 'i-lucide-check-circle-2' : 'i-lucide-circle-x'"
                  :class="feishu.connected ? 'text-green-500' : 'text-gray-400'"
                  class="w-5 h-5 flex-shrink-0"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">Token 有效</span>
              </div>
              <div
                class="flex items-center gap-2.5 p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50"
              >
                <UIcon
                  :name="feishu.features.encrypt ? 'i-lucide-check-circle-2' : 'i-lucide-circle-minus'"
                  :class="feishu.features.encrypt ? 'text-green-500' : 'text-gray-400'"
                  class="w-5 h-5 flex-shrink-0"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">事件加密</span>
              </div>
              <div
                class="flex items-center gap-2.5 p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50"
              >
                <UIcon
                  :name="feishu.features.approval ? 'i-lucide-check-circle-2' : 'i-lucide-circle-minus'"
                  :class="feishu.features.approval ? 'text-green-500' : 'text-gray-400'"
                  class="w-5 h-5 flex-shrink-0"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">审批流程</span>
              </div>
            </div>
          </div>

          <!-- Webhook URL -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              事件回调地址
            </label>
            <div class="flex gap-2">
              <UInput
                :model-value="webhookUrl"
                readonly
                size="md"
                class="flex-1 font-mono text-xs"
              />
              <UButton
                :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
                color="neutral"
                variant="soft"
                size="md"
                @click="copyWebhookUrl"
              >
                {{ copied ? '已复制' : '复制' }}
              </UButton>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1.5">
              <UIcon
                name="i-lucide-info"
                class="w-3.5 h-3.5"
              />
              将此地址填入飞书开放平台 → 事件订阅 → 请求地址
            </p>
          </div>
        </div>
      </UCard>

      <!-- Gitea Webhook -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-orange-50 dark:bg-orange-950 rounded-lg">
                <UIcon
                  name="i-lucide-webhook"
                  class="w-5 h-5 text-orange-600 dark:text-orange-400"
                />
              </div>
              <div>
                <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Gitea Webhook
                </h2>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  系统级事件通知
                </p>
              </div>
            </div>
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="ghost"
              size="sm"
              :loading="loadingWebhook"
              @click="checkWebhookStatus"
            />
          </div>
        </template>

        <div class="space-y-6">
          <!-- 提示信息 -->
          <div class="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div class="flex items-start gap-3">
              <UIcon
                name="i-lucide-info"
                class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
              />
              <div class="flex-1 min-w-0">
                <p class="text-sm text-blue-700 dark:text-blue-300 font-medium mb-1">
                  系统级 Webhook 配置
                </p>
                <p class="text-xs text-blue-600 dark:text-blue-400 mb-3">
                  系统级 Webhook 将自动应用到 Gitea 中的所有仓库，接收所有事件通知。当前 Gitea 版本不支持通过 API 创建系统钩子，请在 Gitea 管理页面中手动创建。
                </p>
                <UButton
                  size="xs"
                  color="primary"
                  variant="solid"
                  icon="i-lucide-external-link"
                  @click="openGiteaWebhooks"
                >
                  前往 Gitea 管理
                </UButton>
              </div>
            </div>
          </div>

          <!-- Webhook URL -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Webhook 回调地址
            </label>
            <div class="flex gap-2">
              <UInput
                :model-value="giteaWebhookUrl"
                readonly
                size="md"
                class="flex-1 font-mono text-xs"
              />
              <UButton
                :icon="copiedGitea ? 'i-lucide-check' : 'i-lucide-copy'"
                color="neutral"
                variant="soft"
                size="md"
                @click="copyGiteaWebhookUrl"
              >
                {{ copiedGitea ? '已复制' : '复制' }}
              </UButton>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1.5">
              <UIcon
                name="i-lucide-info"
                class="w-3.5 h-3.5"
              />
              在 Gitea 中创建系统 Webhook 时使用此地址
            </p>
          </div>

          <!-- Webhook 状态 -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              当前状态
            </h3>
            <div
              v-if="loadingWebhook"
              class="flex flex-col items-center justify-center py-12 text-gray-400"
            >
              <UIcon
                name="i-lucide-loader-2"
                class="w-8 h-8 mb-3 animate-spin"
              />
              <p class="text-sm">
                正在检查状态...
              </p>
            </div>

            <div
              v-else-if="webhookStatus"
              class="p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50"
            >
              <div class="flex items-start gap-3">
                <div
                  class="mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0"
                  :class="[
                    webhookStatus.exists
                      ? (webhookStatus.active ? 'bg-green-500' : 'bg-yellow-500')
                      : 'bg-gray-400',
                  ]"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {{
                        webhookStatus.exists
                          ? (webhookStatus.active ? '运行中' : '已暂停')
                          : '未配置'
                      }}
                    </span>
                    <span
                      v-if="webhookStatus.exists && webhookStatus.events"
                      class="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400"
                    >
                      {{ webhookStatus.events.length }} 个事件
                    </span>
                  </div>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    {{ webhookStatus.message || '接收 Gitea 所有仓库的事件通知，包括 Actions、代码推送等' }}
                  </p>

                  <!-- 详细信息 -->
                  <details
                    v-if="webhookStatus.exists"
                    class="mt-3 group"
                  >
                    <summary class="text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 select-none flex items-center gap-1">
                      <UIcon
                        name="i-lucide-chevron-right"
                        class="w-3 h-3 transition-transform group-open:rotate-90"
                      />
                      查看详细信息
                    </summary>
                    <div class="mt-3 pl-4 space-y-2 text-xs">
                      <div
                        v-if="webhookStatus.url"
                        class="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
                      >
                        <p class="text-gray-500 dark:text-gray-400 mb-1">
                          URL
                        </p>
                        <p class="font-mono text-gray-700 dark:text-gray-300 break-all">
                          {{ webhookStatus.url }}
                        </p>
                      </div>
                      <div
                        v-if="webhookStatus.webhookId"
                        class="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
                      >
                        <p class="text-gray-500 dark:text-gray-400 mb-1">
                          Webhook ID
                        </p>
                        <p class="font-mono text-gray-700 dark:text-gray-300">
                          {{ webhookStatus.webhookId }}
                        </p>
                      </div>
                      <div
                        v-if="webhookStatus.events"
                        class="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
                      >
                        <p class="text-gray-500 dark:text-gray-400 mb-2">
                          订阅事件
                        </p>
                        <div class="flex flex-wrap gap-1.5">
                          <span
                            v-for="event in webhookStatus.events"
                            :key="event"
                            class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-[11px] font-mono text-gray-700 dark:text-gray-300"
                          >
                            {{ event }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
