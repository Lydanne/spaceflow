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

interface AgentSessionParticipant {
  id: string;
  session_id: string;
  user_id: string;
  role: "owner" | "collaborator" | "viewer";
  can_chat: boolean;
  invited_by: string | null;
  joined_at: string;
  gitea_username: string | null;
  avatar_url: string | null;
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
const showSessionSettingsModal = ref(false);
const createLoading = ref(false);
const sendPromptLoading = ref(false);
const sessionSettingsPending = ref(false);
const sessionVisibilitySaving = ref(false);
const messageViewportRef = ref<HTMLElement | null>(null);
const shouldStickToBottom = ref(true);
const sessionParticipants = ref<AgentSessionParticipant[]>([]);
const sessionVisibilityDraft = ref<"public" | "private">("public");
const participantSavingState = reactive<Record<string, boolean>>({});

let autoRefreshTimer: ReturnType<typeof setInterval> | null = null;
const SESSION_MESSAGES_PAGE_LIMIT = 100;

const createForm = reactive({
  title: "",
  prompt: "",
});

const sessionVisibilityOptions = [
  { label: "公开", value: "public" },
  { label: "私有", value: "private" },
];

const participantRoleOptions = [
  { label: "协作者", value: "collaborator" },
  { label: "只读", value: "viewer" },
];

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
    showSessionSettingsModal.value = false;
    sessionParticipants.value = [];
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

function participantRoleLabel(role: AgentSessionParticipant["role"]): string {
  if (role === "owner") return "所有者";
  if (role === "collaborator") return "协作者";
  return "只读";
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

async function loadSessionParticipants(sessionId: string) {
  sessionSettingsPending.value = true;
  try {
    const participants = await $fetch<AgentSessionParticipant[]>(`${sessionsApiBase}/${sessionId}/participants`);
    if (selectedSessionId.value !== sessionId) return;
    sessionParticipants.value = participants;
  } catch (error: unknown) {
    toast.add({ title: getErrorMessage(error, "加载会话参与者失败"), color: "error" });
  } finally {
    if (selectedSessionId.value === sessionId) {
      sessionSettingsPending.value = false;
    }
  }
}

function openSessionSettingsModal() {
  if (!selectedSessionId.value || !sessionDetail.value) return;
  sessionVisibilityDraft.value = sessionDetail.value.visibility;
  showSessionSettingsModal.value = true;
  void loadSessionParticipants(selectedSessionId.value);
}

async function saveSessionVisibility() {
  if (!selectedSessionId.value || !sessionDetail.value) return;
  if (sessionVisibilityDraft.value === sessionDetail.value.visibility) return;

  sessionVisibilitySaving.value = true;
  try {
    await $fetch(`${sessionsApiBase}/${selectedSessionId.value}/visibility`, {
      method: "PATCH",
      body: { visibility: sessionVisibilityDraft.value },
    });
    await Promise.all([refreshCurrentSession(), refreshSessionList()]);
    toast.add({ title: "会话可见性已更新", color: "success" });
  } catch (error: unknown) {
    toast.add({ title: getErrorMessage(error, "更新可见性失败"), color: "error" });
  } finally {
    sessionVisibilitySaving.value = false;
  }
}

async function updateParticipantRole(userId: string, role: "collaborator" | "viewer") {
  if (!selectedSessionId.value) return;
  participantSavingState[userId] = true;
  try {
    await $fetch(`${sessionsApiBase}/${selectedSessionId.value}/participants/${userId}`, {
      method: "PATCH",
      body: { role },
    });
    const target = sessionParticipants.value.find((item) => item.user_id === userId);
    if (target) target.role = role;
  } catch (error: unknown) {
    toast.add({ title: getErrorMessage(error, "更新成员角色失败"), color: "error" });
  } finally {
    delete participantSavingState[userId];
  }
}

async function updateParticipantCanChat(userId: string, canChat: boolean) {
  if (!selectedSessionId.value) return;
  participantSavingState[userId] = true;
  try {
    await $fetch(`${sessionsApiBase}/${selectedSessionId.value}/participants/${userId}`, {
      method: "PATCH",
      body: { can_chat: canChat },
    });
    const target = sessionParticipants.value.find((item) => item.user_id === userId);
    if (target) target.can_chat = canChat;
  } catch (error: unknown) {
    toast.add({ title: getErrorMessage(error, "更新发言权限失败"), color: "error" });
  } finally {
    delete participantSavingState[userId];
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
  <div class="flex flex-col gap-2">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 class="text-base font-semibold tracking-tight leading-none">
          Agents
        </h2>
        <p class="text-xs text-muted mt-0.5">
          会话 + 聊天。运行状态和控制统一在设置页。
        </p>
      </div>
      <div class="flex items-center gap-1.5">
        <UButton
          icon="i-lucide-settings"
          color="neutral"
          variant="ghost"
          size="sm"
          :to="runtimeSettingsPath"
        >
          设置
        </UButton>
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="ghost"
          size="sm"
          :loading="sessionListPending"
          @click="() => refreshSessionList()"
        >
          刷新
        </UButton>
        <UButton
          icon="i-lucide-plus"
          color="primary"
          size="sm"
          @click="openCreateModal"
        >
          新会话
        </UButton>
      </div>
    </div>

    <div class="agents-layout gap-2">
      <aside class="agents-sidebar min-w-0">
        <UCard :ui="{ header: 'px-2.5 py-1.5', body: 'p-0' }">
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-xs font-semibold tracking-wide">
                会话
              </h3>
              <UBadge
                color="neutral"
                variant="subtle"
                size="xs"
              >
                {{ sessions.length }}
              </UBadge>
            </div>
          </template>

          <div class="space-y-1 h-[calc(100dvh-19rem)] min-h-[12rem] overflow-y-auto">
            <div
              v-if="sessionListPending && sessions.length === 0"
              class="py-2 text-center text-muted text-sm"
            >
              <UIcon
                name="i-lucide-loader-2"
                class="w-5 h-5 animate-spin mx-auto mb-2"
              />
              正在加载会话
            </div>

            <div
              v-else-if="sessions.length === 0"
              class="py-6 text-center text-muted text-sm"
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
              class="w-full text-left rounded-md border px-1.5 py-1.5 transition-colors"
              :class="[
                selectedSessionId === item.id
                  ? 'border-primary-500 bg-primary-500/10'
                  : 'border-default hover:bg-gray-500/10',
              ]"
              @click="selectedSessionId = item.id"
            >
              <p class="font-medium text-xs truncate leading-5">
                {{ sessionTitle(item) }}
              </p>
              <div class="mt-0.5 text-[10px] text-muted flex items-center gap-1">
                <span class="inline-flex items-center gap-1">
                  <UIcon
                    name="i-lucide-git-branch"
                    class="w-2.5 h-2.5"
                  />
                  {{ item.working_branch || item.base_branch }}
                </span>
                <span class="opacity-60">·</span>
                <span class="truncate">{{ formatDateTime(item.updated_at) }}</span>
              </div>
            </button>
          </div>
        </UCard>
      </aside>

      <section class="agents-chat min-w-0">
        <UCard :ui="{ body: 'p-0' }">
          <div
            v-if="!selectedSessionId"
            class="h-[calc(100dvh-19rem)] min-h-[14rem] flex items-center justify-center text-muted"
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
            class="h-[calc(100dvh-19rem)] min-h-[14rem] flex items-center justify-center text-muted"
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
            class="h-[calc(100dvh-19rem)] min-h-[14rem] flex items-center justify-center text-red-500 px-6"
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
            <div class="px-2.5 py-1.5 border-b border-default flex flex-wrap items-center justify-between gap-1.5">
              <div>
                <h3 class="text-[13px] font-semibold leading-5">
                  {{ sessionTitle(sessionDetail) }}
                </h3>
                <p class="text-[11px] text-muted mt-0.5">
                  分支 {{ sessionDetail.working_branch || sessionDetail.base_branch }} · {{ formatDateTime(sessionDetail.updated_at) }}
                </p>
              </div>
            <UButton
              icon="i-lucide-settings-2"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="openSessionSettingsModal"
            >
              会话设置
            </UButton>
          </div>

            <div
              ref="messageViewportRef"
              class="h-[calc(100dvh-22rem)] min-h-[12rem] overflow-y-auto px-2.5 py-2.5 space-y-2"
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
                  class="max-w-[78%] rounded-lg border px-2.5 py-2"
                  :class="messageBubbleClass(msg)"
                >
                  <div class="flex flex-wrap items-center gap-1 text-[11px] text-muted mb-1">
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
                  <p class="text-[13px] whitespace-pre-wrap break-words leading-5">
                    {{ msg.content }}
                  </p>
                </div>
              </div>
            </div>

            <div class="border-t border-default p-2 space-y-1.5">
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
                    size="sm"
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

    <UModal v-model:open="showSessionSettingsModal">
      <template #content>
        <div class="p-5 space-y-4">
          <div>
            <h3 class="text-base font-semibold">
              会话设置
            </h3>
            <p
              v-if="sessionDetail"
              class="text-xs text-muted mt-1"
            >
              {{ sessionTitle(sessionDetail) }} · {{ sessionDetail.working_branch || sessionDetail.base_branch }}
            </p>
          </div>

          <div class="rounded-lg border border-default p-3 space-y-3">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-sm font-medium">
                  可见性
                </p>
                <p class="text-xs text-muted mt-0.5">
                  公开会话允许仓库成员查看，私有会话仅参与者可见
                </p>
              </div>
              <div class="flex items-center gap-2">
                <USelect
                  v-model="sessionVisibilityDraft"
                  :items="sessionVisibilityOptions"
                  value-key="value"
                  class="w-28"
                  size="sm"
                  :disabled="!canManageSession || sessionVisibilitySaving"
                />
                <UButton
                  size="sm"
                  color="primary"
                  :loading="sessionVisibilitySaving"
                  :disabled="!canManageSession || !sessionDetail || sessionVisibilityDraft === sessionDetail.visibility"
                  @click="saveSessionVisibility"
                >
                  保存
                </UButton>
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-semibold">
                参与者
              </h4>
              <UButton
                icon="i-lucide-refresh-cw"
                size="xs"
                color="neutral"
                variant="ghost"
                :loading="sessionSettingsPending"
                :disabled="!selectedSessionId"
                @click="selectedSessionId && loadSessionParticipants(selectedSessionId)"
              >
                刷新
              </UButton>
            </div>

            <div
              v-if="sessionSettingsPending"
              class="py-6 text-center text-sm text-muted"
            >
              正在加载参与者...
            </div>

            <div
              v-else-if="sessionParticipants.length === 0"
              class="py-6 text-center text-sm text-muted"
            >
              暂无参与者
            </div>

            <div
              v-else
              class="space-y-2 max-h-72 overflow-y-auto"
            >
              <div
                v-for="participant in sessionParticipants"
                :key="participant.id"
                class="rounded-md border border-default p-2.5 flex items-center justify-between gap-3"
              >
                <div class="min-w-0">
                  <p class="text-sm font-medium truncate">
                    {{ participant.gitea_username || shortId(participant.user_id) }}
                  </p>
                  <p class="text-xs text-muted mt-0.5">
                    {{ participantRoleLabel(participant.role) }} · 加入于 {{ formatDateTime(participant.joined_at) }}
                  </p>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <template v-if="participant.role === 'owner'">
                    <UBadge
                      color="primary"
                      variant="subtle"
                      size="xs"
                    >
                      所有者
                    </UBadge>
                  </template>
                  <template v-else>
                    <USelect
                      :model-value="participant.role"
                      :items="participantRoleOptions"
                      value-key="value"
                      class="w-24"
                      size="xs"
                      :disabled="!canManageSession || participantSavingState[participant.user_id]"
                      @update:model-value="(value) => updateParticipantRole(participant.user_id, value as 'collaborator' | 'viewer')"
                    />
                    <div class="inline-flex items-center gap-1.5">
                      <span class="text-[11px] text-muted">发言</span>
                      <USwitch
                        :model-value="participant.can_chat"
                        size="sm"
                        :disabled="!canManageSession || participantSavingState[participant.user_id]"
                        @update:model-value="(value) => updateParticipantCanChat(participant.user_id, Boolean(value))"
                      />
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </UModal>

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
  grid-template-columns: 13.5rem minmax(0, 1fr);
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
