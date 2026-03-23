<script setup lang="ts">
interface ApprovalFlow {
  id: string;
  status: string;
  payload?: { sceneName?: string };
}

const route = useRoute();
const router = useRouter();

// 从 query 获取参数
const sceneName = computed(() => String(route.query.scene || ""));
const permissions = computed(() => {
  const p = route.query.permissions;
  if (Array.isArray(p)) return p.map(String);
  if (typeof p === "string") return p.split(",");
  return [];
});
const organizationId = computed(() => String(route.query.org_id || ""));
const teamId = computed(() => String(route.query.team_id || ""));
const redirectUrl = computed(() => String(route.query.redirect || "/"));

// 状态
const flowId = ref<string | null>(null);
const status = ref<"idle" | "submitting" | "pending" | "approved" | "rejected" | "cancelled">("idle");
const reason = ref("");
const errorMessage = ref("");
const pollInterval = ref<ReturnType<typeof setInterval> | null>(null);

// 计算属性
const isSubmitting = computed(() => status.value === "submitting");
const isIdle = computed(() => status.value === "idle");
const isPending = computed(() => status.value === "pending" || status.value === "submitting");
const isApproved = computed(() => status.value === "approved");
const isRejected = computed(() => status.value === "rejected");
const isCancelled = computed(() => status.value === "cancelled");

// 检查是否已有待处理的申请
const { data: existingFlows, refresh: refreshFlows } = await useFetch<ApprovalFlow[]>("/api/approval-flows/my", {
  query: {
    flow_type: "permission:scene",
    status: "pending",
    organization_id: organizationId,
  },
});

// 找到匹配场景的待处理申请
const existingFlow = computed(() => {
  if (!existingFlows.value) return null;
  return existingFlows.value.find((f) =>
    f.payload?.sceneName === sceneName.value,
  );
});

// 初始化状态
onMounted(() => {
  if (existingFlow.value) {
    flowId.value = existingFlow.value.id;
    status.value = "pending";
    startPolling();
  }
});

// 提交申请
async function submitRequest() {
  if (!sceneName.value || !permissions.value.length || !organizationId.value || !teamId.value) {
    errorMessage.value = "缺少必要参数";
    return;
  }

  status.value = "submitting";
  errorMessage.value = "";

  try {
    const response = await $fetch("/api/approval-flows", {
      method: "POST",
      body: {
        flow_type: "permission:scene",
        organization_id: organizationId.value,
        payload: {
          sceneName: sceneName.value,
          permissions: permissions.value,
          teamId: teamId.value,
        },
        reason: reason.value || undefined,
      },
    });

    flowId.value = response.id;
    status.value = "pending";
    startPolling();
  } catch (e) {
    status.value = "idle";
    errorMessage.value = e instanceof Error ? e.message : "提交失败";
  }
}

// 轮询检查状态
function startPolling() {
  if (pollInterval.value) return;

  pollInterval.value = setInterval(async () => {
    if (!flowId.value) return;

    try {
      const flow = await $fetch<ApprovalFlow>(`/api/approval-flows/${flowId.value}`);
      if (flow.status === "approved") {
        status.value = "approved";
        stopPolling();
      } else if (flow.status === "rejected") {
        status.value = "rejected";
        stopPolling();
      } else if (flow.status === "cancelled") {
        status.value = "cancelled";
        stopPolling();
      }
    } catch {
      // 忽略轮询错误
    }
  }, 3000);
}

function stopPolling() {
  if (pollInterval.value) {
    clearInterval(pollInterval.value);
    pollInterval.value = null;
  }
}

// 取消申请
async function cancelRequest() {
  if (!flowId.value) return;

  try {
    await $fetch(`/api/approval-flows/${flowId.value}/cancel`, { method: "POST" });
    status.value = "cancelled";
    stopPolling();
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : "取消失败";
  }
}

// 跳转回原页面
function goBack() {
  router.push(redirectUrl.value);
}

// 重新申请
function retry() {
  flowId.value = null;
  status.value = "idle";
  errorMessage.value = "";
  refreshFlows();
}

onUnmounted(() => {
  stopPolling();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
    <UCard class="w-full max-w-lg">
      <!-- 申请表单 -->
      <template v-if="isIdle">
        <div class="text-center mb-6">
          <UIcon
            name="i-lucide-shield-question"
            class="w-12 h-12 text-primary mx-auto mb-3"
          />
          <h1 class="text-xl font-semibold">
            申请场景权限
          </h1>
          <p class="text-gray-500 mt-1">
            您需要申请以下权限才能继续操作
          </p>
        </div>

        <div class="space-y-4">
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">场景名称</label>
            <div class="mt-1 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
              {{ sceneName || '未指定' }}
            </div>
          </div>

          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">所需权限</label>
            <div class="mt-1 flex flex-wrap gap-2">
              <UBadge
                v-for="perm in permissions"
                :key="perm"
                color="primary"
                variant="soft"
              >
                {{ perm }}
              </UBadge>
              <span
                v-if="!permissions.length"
                class="text-gray-400"
              >未指定</span>
            </div>
          </div>

          <UFormField label="申请理由（可选）">
            <UTextarea
              v-model="reason"
              placeholder="请说明申请该权限的原因..."
              :rows="3"
            />
          </UFormField>

          <UAlert
            v-if="errorMessage"
            color="error"
            :title="errorMessage"
          />

          <div class="flex gap-3 pt-2">
            <UButton
              color="neutral"
              variant="outline"
              class="flex-1"
              @click="goBack"
            >
              返回
            </UButton>
            <UButton
              color="primary"
              class="flex-1"
              :loading="isSubmitting"
              :disabled="!sceneName || !permissions.length"
              @click="submitRequest"
            >
              提交申请
            </UButton>
          </div>
        </div>
      </template>

      <!-- 等待审批 -->
      <template v-else-if="isPending">
        <div class="text-center py-8">
          <UIcon
            name="i-lucide-loader-circle"
            class="w-16 h-16 text-primary mx-auto mb-4 animate-spin"
          />
          <h1 class="text-xl font-semibold">
            等待审批中
          </h1>
          <p class="text-gray-500 mt-2">
            您的申请已提交，请等待管理员审批
          </p>
          <p class="text-sm text-gray-400 mt-1">
            审批通过后页面会自动更新
          </p>

          <div class="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-left">
            <div class="text-sm">
              <span class="text-gray-500">场景：</span>
              <span class="font-medium">{{ sceneName }}</span>
            </div>
            <div class="text-sm mt-1">
              <span class="text-gray-500">权限：</span>
              <span class="font-medium">{{ permissions.join(', ') }}</span>
            </div>
          </div>

          <UButton
            color="neutral"
            variant="ghost"
            class="mt-6"
            @click="cancelRequest"
          >
            取消申请
          </UButton>
        </div>
      </template>

      <!-- 审批通过 -->
      <template v-else-if="isApproved">
        <div class="text-center py-8">
          <UIcon
            name="i-lucide-check-circle"
            class="w-16 h-16 text-green-500 mx-auto mb-4"
          />
          <h1 class="text-xl font-semibold text-green-600">
            申请已通过
          </h1>
          <p class="text-gray-500 mt-2">
            您已获得「{{ sceneName }}」场景的权限
          </p>

          <UButton
            color="primary"
            size="lg"
            class="mt-6"
            @click="goBack"
          >
            继续操作
          </UButton>
        </div>
      </template>

      <!-- 审批拒绝 -->
      <template v-else-if="isRejected">
        <div class="text-center py-8">
          <UIcon
            name="i-lucide-x-circle"
            class="w-16 h-16 text-red-500 mx-auto mb-4"
          />
          <h1 class="text-xl font-semibold text-red-600">
            申请已拒绝
          </h1>
          <p class="text-gray-500 mt-2">
            您的权限申请未通过审批
          </p>

          <div class="flex gap-3 mt-6 justify-center">
            <UButton
              color="neutral"
              variant="outline"
              @click="goBack"
            >
              返回
            </UButton>
            <UButton
              color="primary"
              @click="retry"
            >
              重新申请
            </UButton>
          </div>
        </div>
      </template>

      <!-- 已取消 -->
      <template v-else-if="isCancelled">
        <div class="text-center py-8">
          <UIcon
            name="i-lucide-circle-slash"
            class="w-16 h-16 text-gray-400 mx-auto mb-4"
          />
          <h1 class="text-xl font-semibold text-gray-600">
            申请已取消
          </h1>

          <div class="flex gap-3 mt-6 justify-center">
            <UButton
              color="neutral"
              variant="outline"
              @click="goBack"
            >
              返回
            </UButton>
            <UButton
              color="primary"
              @click="retry"
            >
              重新申请
            </UButton>
          </div>
        </div>
      </template>
    </UCard>
  </div>
</template>
