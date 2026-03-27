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
  session_path: string | null;
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

interface AgentSessionEvent {
  id: string;
  session_id: string;
  seq: number;
  type: string;
  payload: Record<string, unknown> | null;
  actor_type: "user" | "agent" | "system" | "bot";
  actor_id: string;
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

interface RepoRuntimeSummary {
  repository_id: string;
  repository_full_name: string;
  mode: "docker";
  root_dir: string;
  repo_root_path: string;
  sessions_root_dir: string;
  runtime: {
    id: string;
    status: string;
    provider: string;
    runtime_key: string | null;
    last_heartbeat_at: string | null;
  } | null;
  runtime_status: string;
  active_session_count: number;
  active_worktree_count: number;
}

const props = defineProps<{
  owner: string;
  repo: string;
}>();

const toast = useToast();
const { user } = useUserSession();
const sessionsApiBase = `/api/repos/${props.owner}/${props.repo}/agents/sessions`;
const runtimeApiBase = `/api/repos/${props.owner}/${props.repo}/agents/runtime`;

const { data: sessionListResp, pending: sessionListPending, refresh: refreshSessionList } = await useFetch<
  PaginatedResponse<AgentSessionSummary>
>(sessionsApiBase, {
  query: {
    page: 1,
    limit: 50,
  },
});

const { data: runtimeSummaryResp, pending: runtimeSummaryPending, refresh: refreshRuntimeSummary } = await useFetch<
  RepoRuntimeSummary
>(runtimeApiBase);

const sessions = computed(() => sessionListResp.value?.data ?? []);
const runtimeSummary = computed(() => runtimeSummaryResp.value || null);
const selectedSessionId = ref<string | null>(null);

const sessionDetail = ref<AgentSessionDetail | null>(null);
const participants = ref<AgentSessionParticipant[]>([]);
const messages = ref<AgentSessionMessage[]>([]);
const events = ref<AgentSessionEvent[]>([]);

const sessionContextPending = ref(false);
const sessionContextError = ref("");
const promptDraft = ref("");

const showCreateModal = ref(false);
const createLoading = ref(false);
const sendPromptLoading = ref(false);
const joinLoading = ref(false);
const leaveLoading = ref(false);
const stopLoading = ref(false);
const retryLoading = ref(false);
const visibilityLoading = ref(false);
const pinningMessageId = ref<string | null>(null);
const runtimeStartLoading = ref(false);
const runtimeStopLoading = ref(false);
const runtimeForceStopLoading = ref(false);
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null;
let autoRefreshTick = 0;

const createForm = reactive({
  title: "",
  prompt: "",
  visibility: "public" as "public" | "private",
  base_branch: "main",
  working_branch: "",
  auto_commit: false,
  auto_pr: false,
});

const visibilityDraft = ref<"public" | "private">("public");
const visibilityOptions = [
  { label: "公开", value: "public" },
  { label: "私有", value: "private" },
];

const createVisibilityOptions = [
  { label: "公开会话", value: "public" },
  { label: "私有会话", value: "private" },
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

const canJoinSession = computed(() => {
  if (!sessionDetail.value) return false;
  return sessionDetail.value.my_role === null;
});

const canLeaveSession = computed(() => {
  if (!sessionDetail.value) return false;
  return sessionDetail.value.my_role !== null && sessionDetail.value.my_role !== "owner";
});

const canPinMessage = computed(() => {
  if (!sessionDetail.value) return false;
  if (canManageSession.value) return true;
  return sessionDetail.value.my_role === "owner" || sessionDetail.value.my_role === "collaborator";
});

watch(
  sessions,
  (list) => {
    if (list.length === 0) {
      selectedSessionId.value = null;
      return;
    }

    if (!selectedSessionId.value || !list.some((item) => item.id === selectedSessionId.value)) {
      selectedSessionId.value = list[0].id;
    }
  },
  { immediate: true },
);

watch(
  () => sessionDetail.value?.visibility,
  (value) => {
    if (value === "public" || value === "private") {
      visibilityDraft.value = value;
    }
  },
  { immediate: true },
);

watch(
  selectedSessionId,
  async (sessionId) => {
    if (!sessionId) {
      sessionDetail.value = null;
      participants.value = [];
      messages.value = [];
      events.value = [];
      sessionContextError.value = "";
      return;
    }
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

function statusBadgeColor(status: string): "info" | "success" | "warning" | "error" | "neutral" {
  if (status === "created") return "info";
  if (status === "running") return "warning";
  if (status === "completed") return "success";
  if (status === "failed") return "error";
  if (status === "stopped") return "neutral";
  return "neutral";
}

function actorTypeColor(type: string): "info" | "success" | "warning" | "error" | "neutral" {
  if (type === "user") return "info";
  if (type === "agent") return "success";
  if (type === "system") return "warning";
  if (type === "bot") return "neutral";
  return "neutral";
}

function runtimeStatusColor(status: string): "info" | "success" | "warning" | "error" | "neutral" {
  if (status === "running") return "success";
  if (status === "starting") return "warning";
  if (status === "stopped") return "neutral";
  if (status === "failed") return "error";
  return "neutral";
}

async function loadSessionContext(sessionId: string) {
  sessionContextPending.value = true;
  sessionContextError.value = "";

  try {
    const [detail, participantList, messageResp, eventResp] = await Promise.all([
      $fetch<AgentSessionDetail>(`${sessionsApiBase}/${sessionId}`),
      $fetch<AgentSessionParticipant[]>(`${sessionsApiBase}/${sessionId}/participants`),
      $fetch<PaginatedResponse<AgentSessionMessage>>(`${sessionsApiBase}/${sessionId}/messages`, {
        query: { page: 1, limit: 200 },
      }),
      $fetch<PaginatedResponse<AgentSessionEvent>>(`${sessionsApiBase}/${sessionId}/events`, {
        query: { page: 1, limit: 100 },
      }),
    ]);

    if (selectedSessionId.value !== sessionId) return;

    sessionDetail.value = detail;
    participants.value = participantList;
    messages.value = messageResp.data;
    events.value = eventResp.data;
  } catch (error: unknown) {
    if (selectedSessionId.value !== sessionId) return;
    sessionContextError.value = getErrorMessage(error, "加载会话详情失败");
  } finally {
    if (selectedSessionId.value === sessionId) {
      sessionContextPending.value = false;
    }
  }
}

async function refreshSessionRealtime(sessionId: string) {
  try {
    const [detail, participantList, messageResp, eventResp] = await Promise.all([
      $fetch<AgentSessionDetail>(`${sessionsApiBase}/${sessionId}`),
      $fetch<AgentSessionParticipant[]>(`${sessionsApiBase}/${sessionId}/participants`),
      $fetch<PaginatedResponse<AgentSessionMessage>>(`${sessionsApiBase}/${sessionId}/messages`, {
        query: { page: 1, limit: 200 },
      }),
      $fetch<PaginatedResponse<AgentSessionEvent>>(`${sessionsApiBase}/${sessionId}/events`, {
        query: { page: 1, limit: 100 },
      }),
    ]);

    if (selectedSessionId.value !== sessionId) return;

    sessionDetail.value = detail;
    participants.value = participantList;
    messages.value = messageResp.data;
    events.value = eventResp.data;
  } catch {
    // 自动刷新失败时不打断用户操作，也不覆盖当前页面状态
  }
}

function startAutoRefresh() {
  if (autoRefreshTimer) return;

  autoRefreshTimer = setInterval(() => {
    const sessionId = selectedSessionId.value;
    autoRefreshTick += 1;
    if (!sessionId) return;
    if (sessionContextPending.value || sendPromptLoading.value || createLoading.value) return;

    void refreshSessionRealtime(sessionId);
    if (autoRefreshTick % 3 === 0) {
      void refreshRuntimeSummary();
    }
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
  createForm.visibility = "public";
  createForm.base_branch = "main";
  createForm.working_branch = "";
  createForm.auto_commit = false;
  createForm.auto_pr = false;
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
        visibility: createForm.visibility,
        base_branch: createForm.base_branch.trim() || "main",
        working_branch: createForm.working_branch.trim() || undefined,
        auto_commit: createForm.auto_commit,
        auto_pr: createForm.auto_pr,
      },
    });

    showCreateModal.value = false;
    resetCreateForm();
    toast.add({ title: "会话创建成功", color: "success" });

    await Promise.all([refreshSessionList(), refreshRuntimeSummary()]);
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

async function startRuntime() {
  runtimeStartLoading.value = true;
  try {
    await $fetch(`${runtimeApiBase}/start`, {
      method: "POST",
    });
    toast.add({ title: "Runtime 已启动", color: "success" });
    await refreshRuntimeSummary();
  } catch (error: unknown) {
    toast.add({ title: getErrorMessage(error, "启动 Runtime 失败"), color: "error" });
  } finally {
    runtimeStartLoading.value = false;
  }
}

async function stopRuntime(force: boolean) {
  if (force) {
    runtimeForceStopLoading.value = true;
  } else {
    runtimeStopLoading.value = true;
  }

  try {
    await $fetch(`${runtimeApiBase}/stop`, {
      method: "POST",
      body: {
        force,
      },
    });
    toast.add({ title: force ? "Runtime 已强制停止" : "Runtime 已停止", color: "success" });
    await Promise.all([refreshRuntimeSummary(), refreshSessionList(), refreshCurrentSession()]);
  } catch (error: unknown) {
    toast.add({ title: getErrorMessage(error, "停止 Runtime 失败"), color: "error" });
  } finally {
    runtimeStopLoading.value = false;
    runtimeForceStopLoading.value = false;
  }
}

async function submitPrompt() {
  if (!selectedSessionId.value || !promptDraft.value.trim()) return;

  sendPromptLoading.value = true;
  try {
    await $fetch(`${sessionsApiBase}/${selectedSessionId.value}/prompt`, {
      method: "POST",
      body: {
        prompt: promptDraft.value.trim(),
      },
    });

    promptDraft.value = "";
    await Promise.all([refreshCurrentSession(), refreshSessionList(), refreshRuntimeSummary()]);
  } catch (error: unknown) {
    toast.add({ title: getErrorMessage(error, "发送消息失败"), color: "error" });
  } finally {
    sendPromptLoading.value = false;
  }
}

async function joinSession() {
  if (!selectedSessionId.value) return;

  joinLoading.value = true;
  try {
    await $fetch(`${sessionsApiBase}/${selectedSessionId.value}/join`, { method: "POST" });
    toast.add({ title: "已加入会话", color: "success" });
    await Promise.all([refreshCurrentSession(), refreshSessionList(), refreshRuntimeSummary()]);
  } catch (error: unknown) {
    toast.add({ title: getErrorMessage(error, "加入会话失败"), color: "error" });
  } finally {
    joinLoading.value = false;
  }
}

async function leaveSession() {
  if (!selectedSessionId.value) return;

  leaveLoading.value = true;
  try {
    await $fetch(`${sessionsApiBase}/${selectedSessionId.value}/leave`, { method: "POST" });
    toast.add({ title: "已退出会话", color: "success" });
    await Promise.all([refreshCurrentSession(), refreshSessionList(), refreshRuntimeSummary()]);
  } catch (error: unknown) {
    toast.add({ title: getErrorMessage(error, "退出会话失败"), color: "error" });
  } finally {
    leaveLoading.value = false;
  }
}

async function stopSession() {
  if (!selectedSessionId.value) return;

  stopLoading.value = true;
  try {
    await $fetch(`${sessionsApiBase}/${selectedSessionId.value}/stop`, { method: "POST" });
    toast.add({ title: "会话已停止", color: "success" });
    await Promise.all([refreshCurrentSession(), refreshSessionList(), refreshRuntimeSummary()]);
  } catch (error: unknown) {
    toast.add({ title: getErrorMessage(error, "停止会话失败"), color: "error" });
  } finally {
    stopLoading.value = false;
  }
}

async function retrySession() {
  if (!selectedSessionId.value) return;

  retryLoading.value = true;
  try {
    await $fetch(`${sessionsApiBase}/${selectedSessionId.value}/retry`, { method: "POST" });
    toast.add({ title: "会话已重试", color: "success" });
    await Promise.all([refreshCurrentSession(), refreshSessionList(), refreshRuntimeSummary()]);
  } catch (error: unknown) {
    toast.add({ title: getErrorMessage(error, "重试会话失败"), color: "error" });
  } finally {
    retryLoading.value = false;
  }
}

async function updateVisibility() {
  if (!selectedSessionId.value) return;

  visibilityLoading.value = true;
  try {
    await $fetch(`${sessionsApiBase}/${selectedSessionId.value}/visibility`, {
      method: "PATCH",
      body: {
        visibility: visibilityDraft.value,
      },
    });
    toast.add({ title: "会话可见性已更新", color: "success" });
    await Promise.all([refreshCurrentSession(), refreshSessionList(), refreshRuntimeSummary()]);
  } catch (error: unknown) {
    toast.add({ title: getErrorMessage(error, "更新可见性失败"), color: "error" });
  } finally {
    visibilityLoading.value = false;
  }
}

async function pinMessage(messageId: string) {
  if (!selectedSessionId.value) return;

  pinningMessageId.value = messageId;
  try {
    await $fetch(`${sessionsApiBase}/${selectedSessionId.value}/messages/${messageId}/pin`, {
      method: "POST",
    });
    await refreshCurrentSession();
  } catch (error: unknown) {
    toast.add({ title: getErrorMessage(error, "置顶消息失败"), color: "error" });
  } finally {
    pinningMessageId.value = null;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold">
          Agents
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          管理仓库级 Agent 会话，支持多人协作对话、事件追踪与任务执行
        </p>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="ghost"
          :loading="sessionListPending"
          @click="refreshSessionList"
        >
          刷新
        </UButton>
        <UButton
          icon="i-lucide-plus"
          color="primary"
          @click="openCreateModal"
        >
          创建会话
        </UButton>
      </div>
    </div>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-semibold">
              Repo Runtime
            </h3>
            <UBadge
              :color="runtimeStatusColor(runtimeSummary?.runtime_status || 'stopped')"
              variant="subtle"
            >
              {{ runtimeSummary?.runtime_status || "stopped" }}
            </UBadge>
            <UBadge
              color="neutral"
              variant="soft"
            >
              {{ runtimeSummary?.mode || "docker" }}
            </UBadge>
          </div>

          <div class="flex items-center gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-refresh-cw"
              :loading="runtimeSummaryPending"
              @click="refreshRuntimeSummary"
            >
              刷新
            </UButton>
            <UButton
              icon="i-lucide-play"
              color="primary"
              :loading="runtimeStartLoading"
              :disabled="runtimeSummary?.runtime_status === 'running'"
              @click="startRuntime"
            >
              启动
            </UButton>
            <UButton
              icon="i-lucide-square"
              color="warning"
              variant="soft"
              :loading="runtimeStopLoading"
              :disabled="runtimeSummary?.runtime_status !== 'running'"
              @click="stopRuntime(false)"
            >
              停止
            </UButton>
            <UButton
              icon="i-lucide-octagon-x"
              color="error"
              variant="ghost"
              :loading="runtimeForceStopLoading"
              :disabled="runtimeSummary?.runtime_status !== 'running'"
              @click="stopRuntime(true)"
            >
              强制停止
            </UButton>
          </div>
        </div>
      </template>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
        <div class="rounded border border-gray-200 dark:border-gray-700 p-3">
          <p class="text-gray-500 mb-1">
            活跃会话
          </p>
          <p class="font-medium text-sm">
            {{ runtimeSummary?.active_session_count ?? 0 }}
          </p>
        </div>
        <div class="rounded border border-gray-200 dark:border-gray-700 p-3">
          <p class="text-gray-500 mb-1">
            活跃 Worktree
          </p>
          <p class="font-medium text-sm">
            {{ runtimeSummary?.active_worktree_count ?? 0 }}
          </p>
        </div>
        <div class="rounded border border-gray-200 dark:border-gray-700 p-3">
          <p class="text-gray-500 mb-1">
            Runtime Key
          </p>
          <p class="font-medium text-sm truncate">
            {{ runtimeSummary?.runtime?.runtime_key || "-" }}
          </p>
        </div>
        <div class="rounded border border-gray-200 dark:border-gray-700 p-3">
          <p class="text-gray-500 mb-1">
            心跳
          </p>
          <p class="font-medium text-sm truncate">
            {{ formatDateTime(runtimeSummary?.runtime?.last_heartbeat_at || null) }}
          </p>
        </div>
      </div>
    </UCard>

    <div class="grid grid-cols-1 xl:grid-cols-12 gap-4">
      <div class="xl:col-span-4">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold">
                会话列表
              </h3>
              <UBadge
                color="neutral"
                variant="subtle"
              >
                {{ sessions.length }}
              </UBadge>
            </div>
          </template>

          <div
            v-if="sessionListPending && sessions.length === 0"
            class="py-10 text-center text-gray-400"
          >
            <UIcon
              name="i-lucide-loader-2"
              class="w-5 h-5 animate-spin mx-auto mb-2"
            />
            正在加载会话
          </div>

          <div
            v-else-if="sessions.length === 0"
            class="py-10 text-center text-gray-400"
          >
            <UIcon
              name="i-lucide-container"
              class="w-10 h-10 mx-auto mb-2"
            />
            <p>暂无会话</p>
            <p class="text-xs mt-1">
              先创建一个 Agent 会话开始协作
            </p>
          </div>

          <div
            v-else
            class="space-y-2"
          >
            <button
              v-for="item in sessions"
              :key="item.id"
              type="button"
              class="w-full text-left rounded-lg border p-3 transition-colors"
              :class="[
                selectedSessionId === item.id
                  ? 'border-primary-500 bg-primary-50/70 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/40',
              ]"
              @click="selectedSessionId = item.id"
            >
              <div class="flex items-start justify-between gap-2">
                <p class="font-medium text-sm truncate">
                  {{ sessionTitle(item) }}
                </p>
                <UBadge
                  :color="statusBadgeColor(item.status)"
                  variant="subtle"
                  size="xs"
                >
                  {{ item.status }}
                </UBadge>
              </div>
              <div class="flex items-center gap-2 mt-2 text-xs text-gray-500">
                <UBadge
                  :color="item.visibility === 'public' ? 'success' : 'warning'"
                  variant="soft"
                  size="xs"
                >
                  {{ item.visibility === "public" ? "公开" : "私有" }}
                </UBadge>
                <span>{{ item.base_branch }}</span>
                <span class="text-gray-300">·</span>
                <span>{{ formatDateTime(item.updated_at) }}</span>
              </div>
            </button>
          </div>
        </UCard>
      </div>

      <div class="xl:col-span-8 space-y-4">
        <UCard v-if="!selectedSessionId">
          <div class="py-12 text-center text-gray-400">
            <UIcon
              name="i-lucide-message-square"
              class="w-10 h-10 mx-auto mb-2"
            />
            请选择一个会话查看详情
          </div>
        </UCard>

        <UCard v-else-if="sessionContextPending">
          <div class="py-12 text-center text-gray-400">
            <UIcon
              name="i-lucide-loader-2"
              class="w-5 h-5 animate-spin mx-auto mb-2"
            />
            正在加载会话详情
          </div>
        </UCard>

        <UCard v-else-if="sessionContextError">
          <div class="py-12 text-center text-red-500">
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
        </UCard>

        <template v-else-if="sessionDetail">
          <UCard>
            <template #header>
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 class="text-base font-semibold">
                    {{ sessionTitle(sessionDetail) }}
                  </h3>
                  <div class="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-2">
                    <span>ID: {{ shortId(sessionDetail.id) }}</span>
                    <span class="text-gray-300">·</span>
                    <span>基线分支 {{ sessionDetail.base_branch }}</span>
                    <span
                      v-if="sessionDetail.working_branch"
                      class="text-gray-300"
                    >·</span>
                    <span v-if="sessionDetail.working_branch">工作分支 {{ sessionDetail.working_branch }}</span>
                  </div>
                </div>

                <div class="flex items-center gap-2 flex-wrap justify-end">
                  <UBadge
                    :color="statusBadgeColor(sessionDetail.status)"
                    variant="subtle"
                  >
                    {{ sessionDetail.status }}
                  </UBadge>
                  <UBadge
                    :color="sessionDetail.visibility === 'public' ? 'success' : 'warning'"
                    variant="subtle"
                  >
                    {{ sessionDetail.visibility === "public" ? "公开" : "私有" }}
                  </UBadge>
                  <UBadge
                    color="neutral"
                    variant="soft"
                  >
                    我的角色: {{ sessionDetail.my_role || "未加入" }}
                  </UBadge>
                  <UBadge
                    v-if="sessionDetail.runtime_status"
                    :color="runtimeStatusColor(sessionDetail.runtime_status)"
                    variant="soft"
                  >
                    Runtime: {{ sessionDetail.runtime_status }}
                  </UBadge>
                  <UBadge
                    v-if="sessionDetail.worktree_status"
                    color="neutral"
                    variant="soft"
                  >
                    Worktree: {{ sessionDetail.worktree_status }}
                  </UBadge>
                </div>
              </div>
            </template>

            <div class="space-y-4">
              <p
                v-if="sessionDetail.prompt"
                class="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap"
              >
                {{ sessionDetail.prompt }}
              </p>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div class="rounded border border-gray-200 dark:border-gray-700 p-3">
                  <p class="text-gray-500 mb-1">
                    参与者
                  </p>
                  <p class="font-medium text-sm">
                    {{ sessionDetail.participant_count }} 人
                  </p>
                </div>
                <div class="rounded border border-gray-200 dark:border-gray-700 p-3">
                  <p class="text-gray-500 mb-1">
                    消息数
                  </p>
                  <p class="font-medium text-sm">
                    {{ sessionDetail.message_count }} 条
                  </p>
                </div>
                <div class="rounded border border-gray-200 dark:border-gray-700 p-3">
                  <p class="text-gray-500 mb-1">
                    更新时间
                  </p>
                  <p class="font-medium text-sm">
                    {{ formatDateTime(sessionDetail.updated_at) }}
                  </p>
                </div>
              </div>

              <div
                v-if="sessionDetail.worktree_path || sessionDetail.worktree_last_error"
                class="rounded border border-gray-200 dark:border-gray-700 p-3 space-y-1 text-xs"
              >
                <p
                  v-if="sessionDetail.worktree_path"
                  class="text-gray-500"
                >
                  Worktree 路径：{{ sessionDetail.worktree_path }}
                </p>
                <p
                  v-if="sessionDetail.worktree_last_error"
                  class="text-red-500"
                >
                  Worktree 错误：{{ sessionDetail.worktree_last_error }}
                </p>
              </div>

              <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <UButton
                  v-if="canJoinSession"
                  icon="i-lucide-log-in"
                  color="primary"
                  :loading="joinLoading"
                  @click="joinSession"
                >
                  加入会话
                </UButton>

                <UButton
                  v-if="canLeaveSession"
                  icon="i-lucide-log-out"
                  color="neutral"
                  variant="ghost"
                  :loading="leaveLoading"
                  @click="leaveSession"
                >
                  退出会话
                </UButton>

                <UButton
                  v-if="canManageSession && sessionDetail.status !== 'stopped' && sessionDetail.status !== 'completed' && sessionDetail.status !== 'failed'"
                  icon="i-lucide-square"
                  color="warning"
                  variant="soft"
                  :loading="stopLoading"
                  @click="stopSession"
                >
                  停止
                </UButton>

                <UButton
                  v-if="canManageSession && (sessionDetail.status === 'failed' || sessionDetail.status === 'stopped')"
                  icon="i-lucide-rotate-cw"
                  color="info"
                  variant="soft"
                  :loading="retryLoading"
                  @click="retrySession"
                >
                  重试
                </UButton>

                <div
                  v-if="canManageSession"
                  class="flex items-center gap-2 ml-auto"
                >
                  <USelect
                    v-model="visibilityDraft"
                    :items="visibilityOptions"
                    value-key="value"
                    size="sm"
                    class="w-28"
                  />
                  <UButton
                    color="neutral"
                    variant="soft"
                    size="sm"
                    :loading="visibilityLoading"
                    @click="updateVisibility"
                  >
                    更新可见性
                  </UButton>
                </div>
              </div>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold">
                  对话消息
                </h3>
                <UBadge
                  color="neutral"
                  variant="subtle"
                >
                  {{ messages.length }}
                </UBadge>
              </div>
            </template>

            <div class="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              <div
                v-if="messages.length === 0"
                class="text-sm text-gray-400 py-4"
              >
                还没有消息，先发起第一条任务描述
              </div>

              <div
                v-for="msg in messages"
                :key="msg.id"
                class="rounded-lg border border-gray-200 dark:border-gray-700 p-3"
              >
                <div class="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-2">
                  <UBadge
                    :color="actorTypeColor(msg.actor_type)"
                    variant="soft"
                    size="xs"
                  >
                    {{ msg.actor_type }}
                  </UBadge>
                  <UBadge
                    color="neutral"
                    variant="subtle"
                    size="xs"
                  >
                    {{ msg.message_type }}
                  </UBadge>
                  <span>#{{ msg.seq }}</span>
                  <span class="text-gray-300">·</span>
                  <span>{{ formatDateTime(msg.created_at) }}</span>
                  <UBadge
                    v-if="msg.pinned"
                    color="warning"
                    variant="subtle"
                    size="xs"
                  >
                    已置顶
                  </UBadge>
                  <div class="ml-auto">
                    <UButton
                      v-if="!msg.pinned && canPinMessage"
                      icon="i-lucide-pin"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      :loading="pinningMessageId === msg.id"
                      @click="pinMessage(msg.id)"
                    >
                      置顶
                    </UButton>
                  </div>
                </div>
                <p class="text-sm whitespace-pre-wrap break-words">
                  {{ msg.content }}
                </p>
              </div>
            </div>

            <div class="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
              <UTextarea
                v-model="promptDraft"
                :rows="4"
                placeholder="输入你的任务描述或追问..."
                class="w-full"
                :disabled="!canChatInSession"
              />
              <div class="flex items-center justify-between">
                <p
                  v-if="!canChatInSession"
                  class="text-xs text-amber-500"
                >
                  你当前没有发言权限，请先加入会话或联系会话所有者
                </p>
                <div class="ml-auto">
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
          </UCard>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <h3 class="text-sm font-semibold">
                    参与者
                  </h3>
                  <UBadge
                    color="neutral"
                    variant="subtle"
                  >
                    {{ participants.length }}
                  </UBadge>
                </div>
              </template>

              <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
                <div
                  v-if="participants.length === 0"
                  class="text-sm text-gray-400 py-2"
                >
                  暂无参与者
                </div>
                <div
                  v-for="item in participants"
                  :key="item.id"
                  class="flex items-center justify-between rounded border border-gray-200 dark:border-gray-700 p-2"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <UAvatar
                      :src="item.avatar_url || undefined"
                      :alt="item.gitea_username || item.user_id"
                      size="xs"
                    />
                    <div class="min-w-0">
                      <p class="text-sm truncate">
                        {{ item.gitea_username || shortId(item.user_id) }}
                      </p>
                      <p class="text-xs text-gray-500">
                        {{ item.can_chat ? "可发言" : "只读" }}
                      </p>
                    </div>
                  </div>
                  <UBadge
                    color="neutral"
                    variant="soft"
                    size="xs"
                  >
                    {{ item.role }}
                  </UBadge>
                </div>
              </div>
            </UCard>

            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <h3 class="text-sm font-semibold">
                    事件流
                  </h3>
                  <UBadge
                    color="neutral"
                    variant="subtle"
                  >
                    {{ events.length }}
                  </UBadge>
                </div>
              </template>

              <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
                <div
                  v-if="events.length === 0"
                  class="text-sm text-gray-400 py-2"
                >
                  暂无事件
                </div>
                <div
                  v-for="eventItem in events"
                  :key="eventItem.id"
                  class="rounded border border-gray-200 dark:border-gray-700 p-2"
                >
                  <div class="flex items-center gap-2 text-xs text-gray-500">
                    <span>#{{ eventItem.seq }}</span>
                    <UBadge
                      :color="actorTypeColor(eventItem.actor_type)"
                      variant="soft"
                      size="xs"
                    >
                      {{ eventItem.actor_type }}
                    </UBadge>
                    <span>{{ eventItem.type }}</span>
                  </div>
                  <p class="text-xs text-gray-400 mt-1">
                    {{ formatDateTime(eventItem.created_at) }} · {{ shortId(eventItem.actor_id) }}
                  </p>
                </div>
              </div>
            </UCard>
          </div>
        </template>
      </div>
    </div>

    <UModal v-model:open="showCreateModal">
      <template #content>
        <div class="p-6 space-y-4">
          <h3 class="text-lg font-semibold">
            创建 Agent 会话
          </h3>

          <div>
            <label class="block text-sm font-medium mb-1">标题（可选）</label>
            <UInput
              v-model="createForm.title"
              placeholder="例如：修复支付回调幂等问题"
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-1">任务描述 *</label>
            <UTextarea
              v-model="createForm.prompt"
              :rows="4"
              placeholder="描述本次要让 Agent 完成的任务"
              class="w-full"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium mb-1">可见性</label>
              <USelect
                v-model="createForm.visibility"
                :items="createVisibilityOptions"
                value-key="value"
                class="w-full"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">基线分支</label>
              <UInput
                v-model="createForm.base_branch"
                placeholder="main"
                class="w-full"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium mb-1">工作分支（可选）</label>
            <UInput
              v-model="createForm.working_branch"
              placeholder="feature/agent-task-001"
              class="w-full"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="flex items-center justify-between rounded border border-gray-200 dark:border-gray-700 p-3">
              <div>
                <p class="text-sm font-medium">
                  自动提交
                </p>
                <p class="text-xs text-gray-500 mt-0.5">
                  完成后自动提交代码
                </p>
              </div>
              <USwitch v-model="createForm.auto_commit" />
            </div>

            <div class="flex items-center justify-between rounded border border-gray-200 dark:border-gray-700 p-3">
              <div>
                <p class="text-sm font-medium">
                  自动 PR
                </p>
                <p class="text-xs text-gray-500 mt-0.5">
                  完成后自动创建 PR
                </p>
              </div>
              <USwitch v-model="createForm.auto_pr" />
            </div>
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
