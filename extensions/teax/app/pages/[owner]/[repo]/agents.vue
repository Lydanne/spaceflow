<script setup lang="ts">
interface AgentSessionSummary {
  id: string;
  title: string | null;
  visibility: "public" | "private";
  creator_id: string;
  runtime_id: string | null;
  status: string;
  base_branch: string;
  working_branch: string | null;
  session_path: string | null;
  created_at: string;
  updated_at: string;
}

interface AgentSessionDetail extends AgentSessionSummary {
  scope: string;
  parent_session_id: string | null;
  prompt: string | null;
  opencode_session_id: string | null;
  auto_commit: boolean;
  auto_pr: boolean;
  pr_url: string | null;
  started_at: string | null;
  finished_at: string | null;
  participant_count: number;
  message_count: number;
  my_role: "owner" | "collaborator" | "viewer" | null;
  my_can_chat: boolean;
  runtime_status: string | null;
  runtime_provider: string | null;
  runtime_last_heartbeat_at: string | null;
  runtime_key: string | null;
  worktree_status: string | null;
  worktree_path: string | null;
  worktree_last_error: string | null;
}

interface AgentSessionMessage {
  id: string;
  session_id: string;
  seq: number;
  actor_type: "user" | "agent" | "system" | "bot";
  actor_id: string;
  message_type: "user_prompt" | "agent_reply" | "system_note" | "tool_summary";
  content: string;
  metadata: Record<string, unknown> | null;
  pinned: boolean;
  pinned_by: string | null;
  pinned_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

const props = defineProps<{
  owner: string;
  repo: string;
}>();

const toast = useToast();
const { user } = useUserSession();
const sessionsApiBase = `/api/repos/${props.owner}/${props.repo}/agents/sessions`;
const runtimeSettingsPath = `/${props.owner}/${props.repo}/settings`;

const { data: sessionListResp, pending: sessionListPending, refresh: refreshSessionList } = await useFetch<
  PaginatedResponse<AgentSessionSummary>
>(sessionsApiBase, {
  query: { page: 1, limit: 50 },
});

const sessions = computed(() => sessionListResp.value?.data ?? []);
const selectedSessionId = ref<string | null>(null);
const sessionDetail = ref<AgentSessionDetail | null>(null);
const messages = ref<AgentSessionMessage[]>([]);

const sessionContextPending = ref(false);
const sessionContextError = ref("");
const promptDraft = ref("");

const showCreateModal = ref(false);
const createLoading = ref(false);
const sendPromptLoading = ref(false);
const messageViewportRef = ref<HTMLElement | null>(null);
const shouldStickToBottom = ref(true);

let autoRefreshTimer: ReturnType<typeof setInterval> | null = null;
const SESSION_MESSAGES_PAGE_LIMIT = 100;

const createForm = reactive({
  title: "",
  prompt: "",
});

const canManageSession = computed(() => {
  if (!sessionDetail.value) return false;
  return sessionDetail.value.my_role === "owner" || user.value?.is_admin === true;
});

const canChatInSession = computed(() => {
  if (!sessionDetail.value) return false;
  if (canManageSession.value) return true;
  return sessionDetail.value.my_can_chat;
});

watch(
  sessions,
  (list) => {
    if (list.length === 0) {
      selectedSessionId.value = null;
      return;
    }

    if (!selectedSessionId.value || !list.some((item) => item.id === selectedSessionId.value)) {
      const firstSession = list[0];
      if (firstSession) selectedSessionId.value = firstSession.id;
    }
  },
  { immediate: true },
);

watch(
  selectedSessionId,
  async (sessionId) => {
    if (!sessionId) {
      sessionDetail.value = null;
      messages.value = [];
      sessionContextError.value = "";
      shouldStickToBottom.value = true;
      return;
    }
    shouldStickToBottom.value = true;
    await loadSessionContext(sessionId);
  },
  { immediate: true },
);

function getErrorMessage(error: unknown, fallback: string): string {
  const messageFromData = (error as { data?: { message?: string } })?.data?.message;
  if (messageFromData) return messageFromData;
  const message = (error as { message?: string })?.message;
  return message || fallback;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function shortId(value: string): string {
  return value.slice(0, 8);
}

function sessionTitle(session: AgentSessionSummary | AgentSessionDetail): string {
  return session.title?.trim() || `会话 ${shortId(session.id)}`;
}

function messageBranchRef(message: AgentSessionMessage): string | null {
  const metadata = message.metadata && typeof message.metadata === "object"
    ? (message.metadata as Record<string, unknown>)
    : {};
  const fromMetadata = String(metadata.branch_ref || "").trim();
  if (fromMetadata) return fromMetadata;
  const fallback = sessionDetail.value?.working_branch || sessionDetail.value?.base_branch || "";
  return fallback.trim() || null;
}

function isUserMessage(message: AgentSessionMessage): boolean {
  return message.actor_type === "user";
}

function messageRowClass(message: AgentSessionMessage): string {
  return isUserMessage(message) ? "flex justify-end" : "flex justify-start";
}

function messageBubbleClass(message: AgentSessionMessage): string {
  if (message.actor_type === "user") {
    return "bg-primary-500/10 border-primary-500/30";
  }
  if (message.actor_type === "agent") {
    return "bg-gray-500/10 border-gray-500/20";
  }
  return "bg-amber-500/10 border-amber-500/30";
}

function messageActorLabel(message: AgentSessionMessage): string {
  if (message.actor_type === "user") return "你";
  if (message.actor_type === "agent") return "Agent";
  if (message.actor_type === "system") return "System";
  return "Bot";
}

function onMessageViewportScroll() {
  const el = messageViewportRef.value;
  if (!el) return;
  const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
  shouldStickToBottom.value = distanceToBottom < 120;
}

async function maybeScrollToBottom(force = false) {
  await nextTick();
  const el = messageViewportRef.value;
  if (!el) return;
  if (force || shouldStickToBottom.value) {
    el.scrollTop = el.scrollHeight;
  }
}

async function loadSessionContext(sessionId: string) {
  sessionContextPending.value = true;
  sessionContextError.value = "";
  try {
    const [detail, messageResp] = await Promise.all([
      $fetch<AgentSessionDetail>(`${sessionsApiBase}/${sessionId}`),
      $fetch<PaginatedResponse<AgentSessionMessage>>(`${sessionsApiBase}/${sessionId}/messages`, {
        query: { page: 1, limit: SESSION_MESSAGES_PAGE_LIMIT },
      }),
    ]);

    if (selectedSessionId.value !== sessionId) return;

    sessionDetail.value = detail;
    messages.value = messageResp.data;
    await maybeScrollToBottom(true);
  } catch (error: unknown) {
    if (selectedSessionId.value !== sessionId) return;
    sessionContextError.value = getErrorMessage(error, "加载会话失败");
  } finally {
    if (selectedSessionId.value === sessionId) {
      sessionContextPending.value = false;
    }
  }
}

async function refreshSessionRealtime(sessionId: string) {
  try {
    const [detail, messageResp] = await Promise.all([
      $fetch<AgentSessionDetail>(`${sessionsApiBase}/${sessionId}`),
      $fetch<PaginatedResponse<AgentSessionMessage>>(`${sessionsApiBase}/${sessionId}/messages`, {
        query: { page: 1, limit: SESSION_MESSAGES_PAGE_LIMIT },
      }),
    ]);
    if (selectedSessionId.value !== sessionId) return;
    sessionDetail.value = detail;
    messages.value = messageResp.data;
    await maybeScrollToBottom(false);
  } catch {
    // 静默失败，避免打断用户输入
  }
}

function startAutoRefresh() {
  if (autoRefreshTimer) return;
  autoRefreshTimer = setInterval(() => {
    const sessionId = selectedSessionId.value;
    if (!sessionId) return;
    if (sessionContextPending.value || sendPromptLoading.value || createLoading.value) return;
    void refreshSessionRealtime(sessionId);
  }, 6000);
}

function stopAutoRefresh() {
  if (!autoRefreshTimer) return;
  clearInterval(autoRefreshTimer);
  autoRefreshTimer = null;
}

onMounted(() => {
  startAutoRefresh();
});

onBeforeUnmount(() => {
  stopAutoRefresh();
});

function openCreateModal() {
  showCreateModal.value = true;
}

function resetCreateForm() {
  createForm.title = "";
  createForm.prompt = "";
}

async function createSession() {
  if (!createForm.prompt.trim()) {
    toast.add({ title: "请输入任务描述", color: "warning" });
    return;
  }

  createLoading.value = true;
  try {
    const created = await $fetch<AgentSessionSummary>(sessionsApiBase, {
      method: "POST",
      body: {
        title: createForm.title.trim() || undefined,
        prompt: createForm.prompt.trim(),
      },
    });
    showCreateModal.value = false;
    resetCreateForm();
    await refreshSessionList();
    selectedSessionId.value = created.id;
    await loadSessionContext(created.id);
  } catch (error: unknown) {
    toast.add({ title: getErrorMessage(error, "创建会话失败"), color: "error" });
  } finally {
    createLoading.value = false;
  }
}

async function refreshCurrentSession() {
  if (!selectedSessionId.value) return;
  await loadSessionContext(selectedSessionId.value);
}

async function submitPrompt() {
  if (!selectedSessionId.value || !promptDraft.value.trim()) return;

  sendPromptLoading.value = true;
  try {
    const branchRef = sessionDetail.value?.working_branch || sessionDetail.value?.base_branch || null;
    await $fetch(`${sessionsApiBase}/${selectedSessionId.value}/prompt`, {
      method: "POST",
      body: {
        prompt: promptDraft.value.trim(),
        metadata: {
          branch_ref: branchRef,
          session_id: selectedSessionId.value,
        },
      },
    });
    promptDraft.value = "";
    await Promise.all([refreshCurrentSession(), refreshSessionList()]);
    await maybeScrollToBottom(true);
  } catch (error: unknown) {
    toast.add({ title: getErrorMessage(error, "发送消息失败"), color: "error" });
  } finally {
    sendPromptLoading.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 class="text-base font-semibold tracking-tight leading-none">
          Agents
        </h2>
        <p class="text-xs text-muted mt-0.5">
          会话 + 聊天。运行状态和控制统一在设置页。
        </p>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-settings"
          color="neutral"
          variant="ghost"
          :to="runtimeSettingsPath"
        >
          设置
        </UButton>
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="ghost"
          :loading="sessionListPending"
          @click="() => refreshSessionList()"
        >
          刷新
        </UButton>
        <UButton
          icon="i-lucide-plus"
          color="primary"
          @click="openCreateModal"
        >
          新会话
        </UButton>
      </div>
    </div>

    <div class="agents-layout gap-3">
      <aside class="agents-sidebar min-w-0">
        <UCard :ui="{ body: 'p-0' }">
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-semibold">
              会话
            </h3>
            <UBadge
              color="neutral"
              variant="subtle"
            >
              {{ sessions.length }}
            </UBadge>
          </div>
        </template>

        <div class="p-2 space-y-2 h-[calc(100dvh-18rem)] min-h-[14rem] overflow-y-auto">
          <div
            v-if="sessionListPending && sessions.length === 0"
            class="py-10 text-center text-muted text-sm"
          >
            <UIcon
              name="i-lucide-loader-2"
              class="w-5 h-5 animate-spin mx-auto mb-2"
            />
            正在加载会话
          </div>

          <div
            v-else-if="sessions.length === 0"
            class="py-10 text-center text-muted text-sm"
          >
            <UIcon
              name="i-lucide-message-square-plus"
              class="w-8 h-8 mx-auto mb-2"
            />
            暂无会话
          </div>

          <button
            v-for="item in sessions"
            :key="item.id"
            type="button"
            class="w-full text-left rounded-lg border px-2.5 py-2 transition-colors"
            :class="[
              selectedSessionId === item.id
                ? 'border-primary-500 bg-primary-500/10'
                : 'border-default hover:bg-gray-500/10',
            ]"
            @click="selectedSessionId = item.id"
          >
            <p class="font-medium text-sm truncate">
              {{ sessionTitle(item) }}
            </p>
            <div class="mt-1.5 text-xs text-muted flex items-center gap-1.5">
              <span class="inline-flex items-center gap-1">
                <UIcon
                  name="i-lucide-git-branch"
                  class="w-3 h-3"
                />
                {{ item.working_branch || item.base_branch }}
              </span>
              <span>·</span>
              <span>{{ formatDateTime(item.updated_at) }}</span>
            </div>
          </button>
        </div>
        </UCard>
      </aside>

      <section class="agents-chat min-w-0">
        <UCard :ui="{ body: 'p-0' }">
        <div
          v-if="!selectedSessionId"
          class="h-[calc(100dvh-18rem)] min-h-[16rem] flex items-center justify-center text-muted"
        >
          <div class="text-center">
            <UIcon
              name="i-lucide-message-square"
              class="w-10 h-10 mx-auto mb-2"
            />
            选择一个会话开始聊天
          </div>
        </div>

        <div
          v-else-if="sessionContextPending"
          class="h-[calc(100dvh-18rem)] min-h-[16rem] flex items-center justify-center text-muted"
        >
          <div class="text-center">
            <UIcon
              name="i-lucide-loader-2"
              class="w-5 h-5 animate-spin mx-auto mb-2"
            />
            正在加载聊天
          </div>
        </div>

        <div
          v-else-if="sessionContextError"
          class="h-[calc(100dvh-18rem)] min-h-[16rem] flex items-center justify-center text-red-500 px-6"
        >
          <div class="text-center">
            <UIcon
              name="i-lucide-alert-triangle"
              class="w-8 h-8 mx-auto mb-2"
            />
            <p>{{ sessionContextError }}</p>
            <UButton
              class="mt-3"
              color="neutral"
              variant="ghost"
              icon="i-lucide-refresh-cw"
              @click="refreshCurrentSession"
            >
              重试
            </UButton>
          </div>
        </div>

        <template v-else-if="sessionDetail">
          <div class="px-3 py-2 border-b border-default flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 class="text-sm font-semibold">
                {{ sessionTitle(sessionDetail) }}
              </h3>
              <p class="text-xs text-muted mt-0.5">
                分支 {{ sessionDetail.working_branch || sessionDetail.base_branch }} · {{ formatDateTime(sessionDetail.updated_at) }}
              </p>
            </div>
            <UButton
              icon="i-lucide-settings-2"
              color="neutral"
              variant="ghost"
              size="sm"
              :to="runtimeSettingsPath"
            >
              设置
            </UButton>
          </div>

          <div
            ref="messageViewportRef"
            class="h-[calc(100dvh-22rem)] min-h-[14rem] overflow-y-auto px-3 py-3 space-y-2.5"
            @scroll="onMessageViewportScroll"
          >
            <div
              v-if="messages.length === 0"
              class="text-sm text-muted py-4"
            >
              还没有消息，发第一条开始对话
            </div>
            <div
              v-for="msg in messages"
              :key="msg.id"
              class="w-full"
              :class="messageRowClass(msg)"
            >
              <div
                class="max-w-[82%] rounded-xl border px-3 py-2.5"
                :class="messageBubbleClass(msg)"
              >
                <div class="flex flex-wrap items-center gap-1.5 text-xs text-muted mb-1.5">
                  <span>{{ messageActorLabel(msg) }}</span>
                  <span>·</span>
                  <span>{{ formatDateTime(msg.created_at) }}</span>
                  <UBadge
                    v-if="messageBranchRef(msg)"
                    color="info"
                    variant="subtle"
                    size="xs"
                  >
                    {{ messageBranchRef(msg) }}
                  </UBadge>
                </div>
                <p class="text-sm whitespace-pre-wrap break-words leading-6">
                  {{ msg.content }}
                </p>
              </div>
            </div>
          </div>

          <div class="border-t border-default p-2.5 space-y-2">
            <UTextarea
              v-model="promptDraft"
              :rows="2"
              placeholder="输入消息..."
              class="w-full"
              :disabled="!canChatInSession"
            />
            <div class="flex items-center justify-between">
              <p
                v-if="!canChatInSession"
                class="text-xs text-amber-500"
              >
                你当前没有发言权限，请在设置页调整权限
              </p>
              <div class="ml-auto flex items-center gap-2">
                <UButton
                  icon="i-lucide-send"
                  color="primary"
                  :loading="sendPromptLoading"
                  :disabled="!canChatInSession || !promptDraft.trim()"
                  @click="submitPrompt"
                >
                  发送
                </UButton>
              </div>
            </div>
          </div>
        </template>
        </UCard>
      </section>
    </div>

    <UModal v-model:open="showCreateModal">
      <template #content>
        <div class="p-6 space-y-4">
          <h3 class="text-lg font-semibold">
            新建会话
          </h3>
          <div>
            <label class="block text-sm font-medium mb-1">标题（可选）</label>
            <UInput
              v-model="createForm.title"
              placeholder="例如：修复支付回调"
              class="w-full"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">首条消息 *</label>
            <UTextarea
              v-model="createForm.prompt"
              :rows="4"
              placeholder="描述你希望 Agent 完成的任务"
              class="w-full"
            />
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <UButton
              color="neutral"
              variant="ghost"
              @click="showCreateModal = false"
            >
              取消
            </UButton>
            <UButton
              icon="i-lucide-plus"
              color="primary"
              :loading="createLoading"
              :disabled="!createForm.prompt.trim()"
              @click="createSession"
            >
              创建
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.agents-layout {
  display: grid;
  grid-template-columns: 18rem minmax(0, 1fr);
  align-items: stretch;
}

.agents-sidebar,
.agents-chat {
  min-width: 0;
}

@media (max-width: 1024px) {
  .agents-layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
