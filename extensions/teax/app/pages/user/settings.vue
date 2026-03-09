<script setup lang="ts">
const { user } = useUserSession();
const toast = useToast();

// ─── 飞书绑定状态 ─────────────────────────────────────────

interface FeishuBinding {
  id: string;
  feishu_open_id: string;
  feishu_name: string;
  feishu_avatar: string | null;
  notify_publish: boolean | null;
  notify_approval: boolean | null;
  notify_agent: boolean | null;
  notify_system: boolean | null;
  created_at: string;
}

const { data: bindingData, refresh: refreshBinding } = await useFetch<{ data: FeishuBinding | null }>(
  "/api/user/feishu-binding",
  { key: "user-feishu-binding" },
);
const binding = computed(() => bindingData.value?.data ?? null);

// ─── 解绑飞书 ─────────────────────────────────────────────

const unbinding = ref(false);
async function unbindFeishu() {
  if (!confirm("确定解绑飞书账号？解绑后将无法通过飞书登录或接收通知。")) return;
  unbinding.value = true;
  try {
    await $fetch("/api/user/feishu-binding", { method: "DELETE" });
    toast.add({ title: "已解绑飞书账号", color: "success" });
    await refreshBinding();
  } catch (err: unknown) {
    const msg = (err as { data?: { message?: string } })?.data?.message || "解绑失败";
    toast.add({ title: msg, color: "error" });
  } finally {
    unbinding.value = false;
  }
}

// ─── 绑定飞书（跳转 OAuth） ────────────────────────────────

function bindFeishu() {
  navigateTo("/api/auth/feishu", { external: true });
}

// ─── 通知偏好 ─────────────────────────────────────────────

const notifyPublish = ref(true);
const notifyApproval = ref(true);
const notifyAgent = ref(true);
const notifySystem = ref(false);

watch(binding, (val) => {
  if (val) {
    notifyPublish.value = val.notify_publish ?? true;
    notifyApproval.value = val.notify_approval ?? true;
    notifyAgent.value = val.notify_agent ?? true;
    notifySystem.value = val.notify_system ?? false;
  }
}, { immediate: true });

const savingPreferences = ref(false);
async function savePreferences() {
  savingPreferences.value = true;
  try {
    await $fetch("/api/user/notify-preferences", {
      method: "PATCH",
      body: {
        notify_publish: notifyPublish.value,
        notify_approval: notifyApproval.value,
        notify_agent: notifyAgent.value,
        notify_system: notifySystem.value,
      },
    });
    toast.add({ title: "通知偏好已保存", color: "success" });
    await refreshBinding();
  } catch (err: unknown) {
    const msg = (err as { data?: { message?: string } })?.data?.message || "保存失败";
    toast.add({ title: msg, color: "error" });
  } finally {
    savingPreferences.value = false;
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold mb-6">
      用户设置
    </h1>

    <!-- 账号信息 -->
    <UCard class="mb-6">
      <template #header>
        <h2 class="text-lg font-semibold">
          账号信息
        </h2>
      </template>
      <div class="space-y-4">
        <div class="flex items-center gap-4">
          <UAvatar
            :src="user?.avatar_url || undefined"
            :alt="user?.username"
            size="xl"
          />
          <div class="flex-1">
            <p class="font-semibold text-lg">
              {{ user?.username }}
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ user?.email }}
            </p>
            <UBadge
              v-if="user?.is_admin"
              color="primary"
              variant="subtle"
              size="xs"
              class="mt-1"
            >
              管理员
            </UBadge>
          </div>
        </div>

        <USeparator />

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              用户 ID
            </p>
            <p class="font-mono text-xs mt-1">
              {{ user?.id }}
            </p>
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Gitea 用户名
            </p>
            <p class="font-medium mt-1">
              {{ user?.username }}
            </p>
          </div>
        </div>
      </div>
    </UCard>

    <!-- 飞书绑定 -->
    <UCard class="mb-6">
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">
            飞书绑定
          </h2>
          <UBadge
            :color="binding ? 'success' : 'neutral'"
            variant="subtle"
          >
            {{ binding ? '已绑定' : '未绑定' }}
          </UBadge>
        </div>
      </template>

      <div v-if="binding">
        <div class="space-y-4">
          <div class="flex items-center gap-4">
            <UAvatar
              :src="binding.feishu_avatar || undefined"
              :alt="binding.feishu_name"
              size="lg"
            />
            <div class="flex-1">
              <p class="font-medium">
                {{ binding.feishu_name }}
              </p>
              <p class="text-xs text-gray-400 font-mono">
                {{ binding.feishu_open_id }}
              </p>
            </div>
          </div>

          <USeparator />

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                绑定时间
              </p>
              <p class="text-sm mt-1">
                {{ new Date(binding.created_at).toLocaleString('zh-CN') }}
              </p>
            </div>
            <div>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                绑定 ID
              </p>
              <p class="font-mono text-xs mt-1">
                {{ binding.id }}
              </p>
            </div>
          </div>

          <div class="pt-2">
            <UButton
              color="error"
              variant="outline"
              size="sm"
              icon="i-lucide-unlink"
              :loading="unbinding"
              @click="unbindFeishu"
            >
              解绑飞书账号
            </UButton>
          </div>
        </div>
      </div>

      <div
        v-else
        class="text-center py-6"
      >
        <UIcon
          name="i-lucide-message-square"
          class="w-10 h-10 mx-auto mb-3 text-gray-400"
        />
        <p class="text-gray-500 dark:text-gray-400 mb-4">
          绑定飞书账号以接收构建通知、审批提醒和机器人交互
        </p>
        <UButton
          color="primary"
          icon="i-lucide-link"
          @click="bindFeishu"
        >
          绑定飞书账号
        </UButton>
      </div>
    </UCard>

    <!-- 通知偏好 -->
    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">
          通知偏好
        </h2>
      </template>

      <div
        v-if="!binding"
        class="text-center py-4 text-gray-400"
      >
        <p>请先绑定飞书账号</p>
      </div>

      <div
        v-else
        class="space-y-4"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium">
              构建通知
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              CI/CD 构建成功或失败时发送通知
            </p>
          </div>
          <USwitch v-model="notifyPublish" />
        </div>

        <USeparator />

        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium">
              审批通知
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              审批请求和审批结果通知
            </p>
          </div>
          <USwitch v-model="notifyApproval" />
        </div>

        <USeparator />

        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium">
              Agent 通知
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              AI Agent 运行完成或失败通知
            </p>
          </div>
          <USwitch v-model="notifyAgent" />
        </div>

        <USeparator />

        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium">
              系统通知
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              系统维护、版本更新等通知
            </p>
          </div>
          <USwitch v-model="notifySystem" />
        </div>

        <div class="pt-4">
          <UButton
            color="primary"
            :loading="savingPreferences"
            @click="savePreferences"
          >
            保存偏好
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
