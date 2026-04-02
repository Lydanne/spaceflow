<script setup lang="ts">
import type { ProjectDetailDto } from "~~/server/shared/dto";
import { REPO_NOTIFY_EVENT_OPTIONS, type RepoNotifyEvent } from "~~/shared/notify-events";
import type { NotifyRule, RepoNotifySettings } from "~~/shared/notify-rules";

const props = defineProps<{
  owner: string;
  repo: string;
  project: ProjectDetailDto;
}>();

const toast = useToast();
const runtimeApiBase = `/api/repos/${props.owner}/${props.repo}/agents/runtime`;

interface RepoRuntimeSummary {
  repository_id: string;
  repository_full_name: string;
  mode: "docker";
  root_dir: string;
  repo_root_path: string;
  sessions_root_dir: string;
  opencode_start_command: string | null;
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

const runtimeSummary = ref<RepoRuntimeSummary | null>(null);
const runtimeSummaryPending = ref(false);
const runtimeStartLoading = ref(false);
const runtimeStopLoading = ref(false);
const runtimeForceStopLoading = ref(false);
const runtimeRestartLoading = ref(false);

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function runtimeStatusColor(status: string): "info" | "success" | "warning" | "error" | "neutral" {
  if (status === "running") return "success";
  if (status === "starting") return "warning";
  if (status === "stopped") return "neutral";
  if (status === "failed") return "error";
  return "neutral";
}

async function refreshRuntimeSummary() {
  runtimeSummaryPending.value = true;
  try {
    runtimeSummary.value = await $fetch<RepoRuntimeSummary>(runtimeApiBase);
  } catch (error: unknown) {
    const message = (error as { data?: { message?: string } })?.data?.message || "加载 Runtime 状态失败";
    toast.add({ title: message, color: "error" });
  } finally {
    runtimeSummaryPending.value = false;
  }
}

async function startRuntime() {
  runtimeStartLoading.value = true;
  toast.add({ title: "正在启动 Runtime，首次构建可能需要几分钟", color: "info" });
  try {
    runtimeSummary.value = await $fetch<RepoRuntimeSummary>(`${runtimeApiBase}/start`, { method: "POST" });
    toast.add({ title: "Runtime 已启动", color: "success" });
  } catch (error: unknown) {
    const message = (error as { data?: { message?: string } })?.data?.message || "启动 Runtime 失败";
    toast.add({ title: message, color: "error" });
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
    const result = await $fetch<{ summary?: RepoRuntimeSummary }>(`${runtimeApiBase}/stop`, {
      method: "POST",
      body: { force },
    });
    runtimeSummary.value = result.summary || null;
    toast.add({ title: force ? "Runtime 已强制停止" : "Runtime 已停止", color: "success" });
  } catch (error: unknown) {
    const message = (error as { data?: { message?: string } })?.data?.message || "停止 Runtime 失败";
    toast.add({ title: message, color: "error" });
  } finally {
    runtimeStopLoading.value = false;
    runtimeForceStopLoading.value = false;
  }
}

async function restartRuntime() {
  runtimeRestartLoading.value = true;
  try {
    if (runtimeSummary.value?.runtime_status === "running") {
      await $fetch<{ summary?: RepoRuntimeSummary }>(`${runtimeApiBase}/stop`, {
        method: "POST",
        body: { force: false },
      });
    }
    runtimeSummary.value = await $fetch<RepoRuntimeSummary>(`${runtimeApiBase}/start`, { method: "POST" });
    toast.add({ title: "Runtime 已重启", color: "success" });
  } catch (error: unknown) {
    const message = (error as { data?: { message?: string } })?.data?.message || "重启 Runtime 失败";
    toast.add({ title: message, color: "error" });
  } finally {
    runtimeRestartLoading.value = false;
  }
}

onMounted(() => {
  void refreshRuntimeSummary();
});

// ─── 事件类型常量 ──────────────────────────────────────
const NOTIFY_EVENTS = REPO_NOTIFY_EVENT_OPTIONS;

// 表单内使用“布尔开关 + 规则数组”
interface ProjectSettings {
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  approvalRequired: boolean;
  notifyRules: NotifyRule[];
}

const settingsForm = reactive<ProjectSettings>({
  notifyOnSuccess: true,
  notifyOnFailure: true,
  approvalRequired: false,
  notifyRules: [],
});

const savingSettings = ref(false);
const editingRuleId = ref<string | null>(null);
const syncingWatch = ref(false);
const watchState = reactive({
  watching: false,
  watchSyncedAt: null as string | null,
});

watch(
  () => props.project.settings,
  (s) => {
    if (!s) return;
    const ps = s as RepoNotifySettings;
    settingsForm.notifyOnSuccess = ps.notifyOnSuccess ?? true;
    settingsForm.notifyOnFailure = ps.notifyOnFailure ?? true;
    settingsForm.approvalRequired = ps.approvalRequired ?? false;
    settingsForm.notifyRules = (ps.notifyRules || []).map((r) => ({ ...r }));
  },
  { immediate: true },
);

watch(
  () => [props.project.watching, props.project.watch_synced_at] as const,
  ([watching, watchSyncedAt]) => {
    watchState.watching = watching;
    watchState.watchSyncedAt = watchSyncedAt;
  },
  { immediate: true },
);

function addRule() {
  const rule: NotifyRule = {
    id: crypto.randomUUID(),
    name: "",
    chatId: "",
    events: [],
    branches: [],
    workflows: [],
  };
  settingsForm.notifyRules.push(rule);
  editingRuleId.value = rule.id;
}

function removeRule(id: string) {
  settingsForm.notifyRules = settingsForm.notifyRules.filter((r) => r.id !== id);
  if (editingRuleId.value === id) editingRuleId.value = null;
}

function toggleEvent(rule: NotifyRule, event: RepoNotifyEvent) {
  const idx = rule.events.indexOf(event);
  if (idx >= 0) rule.events.splice(idx, 1);
  else rule.events.push(event);
}

function parseTags(input: string): string[] {
  return input.split(",").map((s) => s.trim()).filter(Boolean);
}

async function syncWatchState() {
  if (syncingWatch.value) return;
  syncingWatch.value = true;
  try {
    const res = await $fetch<{ data: { watching: boolean; synced_at: string | null } }>(
      `/api/repos/${props.owner}/${props.repo}/watch-sync`,
      { method: "POST" },
    );
    watchState.watching = res.data.watching;
    watchState.watchSyncedAt = res.data.synced_at;
    toast.add({ title: "Watch 状态已同步", color: "success" });
  } catch {
    toast.add({ title: "同步 Watch 状态失败", color: "error" });
  } finally {
    syncingWatch.value = false;
  }
}

async function saveSettings() {
  // 校验规则
  for (const rule of settingsForm.notifyRules) {
    if (!rule.name.trim()) {
      toast.add({ title: "请填写规则名称", color: "warning" });
      editingRuleId.value = rule.id;
      return;
    }
    if (!rule.chatId.trim()) {
      toast.add({ title: "请填写飞书群 Chat ID", color: "warning" });
      editingRuleId.value = rule.id;
      return;
    }
    if (rule.events.length === 0) {
      toast.add({ title: "请至少选择一个事件类型", color: "warning" });
      editingRuleId.value = rule.id;
      return;
    }
  }

  savingSettings.value = true;
  try {
    await $fetch(`/api/repos/${props.owner}/${props.repo}/settings`, {
      method: "PATCH",
      body: {
        notifyOnSuccess: settingsForm.notifyOnSuccess,
        notifyOnFailure: settingsForm.notifyOnFailure,
        approvalRequired: settingsForm.approvalRequired,
        notifyRules: settingsForm.notifyRules,
      },
    });
    toast.add({ title: "设置已保存", color: "success" });
    editingRuleId.value = null;
  } catch {
    toast.add({ title: "保存失败", color: "error" });
  } finally {
    savingSettings.value = false;
  }
}

// ─── 删除项目 ──────────────────────────────────────────
const deleting = ref(false);
const confirmDeleteName = ref("");

async function deleteProject() {
  if (confirmDeleteName.value !== props.project.full_name) return;
  deleting.value = true;
  try {
    await $fetch(`/api/repos/${props.owner}/${props.repo}`, {
      method: "DELETE",
    });
    toast.add({ title: "项目已删除", color: "success" });
    navigateTo(`/${props.project.full_name.split("/")[0]}`);
  } catch {
    toast.add({ title: "删除失败", color: "error" });
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- 基本信息 -->
    <UCard>
      <template #header>
        <h3 class="font-semibold">
          基本信息
        </h3>
      </template>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <p class="text-gray-500 dark:text-gray-400">
            项目名称
          </p>
          <p class="font-medium mt-0.5">
            {{ project.full_name }}
          </p>
        </div>
        <div>
          <p class="text-gray-500 dark:text-gray-400">
            默认分支
          </p>
          <p class="font-medium mt-0.5">
            {{ project.default_branch }}
          </p>
        </div>
        <div>
          <p class="text-gray-500 dark:text-gray-400">
            Clone URL
          </p>
          <p class="font-medium font-mono text-xs mt-0.5 break-all">
            {{ project.clone_url }}
          </p>
        </div>
        <div>
          <p class="text-gray-500 dark:text-gray-400">
            Webhook
          </p>
          <p class="font-medium mt-0.5">
            系统级 Webhook（全局统一）
          </p>
        </div>
      </div>
    </UCard>

    <!-- Agents Runtime -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <h3 class="font-semibold">
              Agents Runtime
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
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="ghost"
              :loading="runtimeSummaryPending"
              @click="refreshRuntimeSummary"
            >
              刷新
            </UButton>
            <UButton
              icon="i-lucide-play"
              color="primary"
              :loading="runtimeStartLoading"
              :disabled="runtimeStartLoading"
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
              icon="i-lucide-refresh-cw"
              color="info"
              variant="soft"
              :loading="runtimeRestartLoading"
              @click="restartRuntime"
            >
              重启
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
            活跃目录
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
            最近心跳
          </p>
          <p class="font-medium text-sm truncate">
            {{ formatDateTime(runtimeSummary?.runtime?.last_heartbeat_at || null) }}
          </p>
        </div>
      </div>
      <p class="text-xs text-gray-500 mt-3">
        会话目录根路径：{{ runtimeSummary?.sessions_root_dir || "-" }}
      </p>
      <p class="text-xs text-gray-500 mt-1">
        Opencode 默认启动命令：{{ runtimeSummary?.opencode_start_command || "自动回退（opencode serve/server）" }}
      </p>
    </UCard>

    <!-- 飞书集成 -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <UIcon
              name="i-simple-icons-bytedance"
              class="w-4 h-4"
            />
            <h3 class="font-semibold">
              飞书通知规则
            </h3>
          </div>
          <UButton
            icon="i-lucide-plus"
            size="xs"
            color="primary"
            variant="soft"
            @click="addRule"
          >
            添加规则
          </UButton>
        </div>
      </template>

      <!-- 规则列表 -->
      <div
        v-if="settingsForm.notifyRules.length > 0"
        class="space-y-4"
      >
        <div
          v-for="rule in settingsForm.notifyRules"
          :key="rule.id"
          class="border rounded-lg p-4 space-y-3"
          :class="editingRuleId === rule.id
            ? 'border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-950/30'
            : 'border-gray-200 dark:border-gray-800'
          "
        >
          <!-- 规则头部：名称 + 操作 -->
          <div class="flex items-center justify-between gap-2">
            <div
              v-if="editingRuleId === rule.id"
              class="flex-1"
            >
              <UInput
                v-model="rule.name"
                placeholder="规则名称，如：生产告警"
                size="sm"
              />
            </div>
            <div
              v-else
              class="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
              @click="editingRuleId = rule.id"
            >
              <span class="font-medium text-sm truncate">{{ rule.name || '未命名规则' }}</span>
              <UBadge
                color="neutral"
                variant="subtle"
                size="xs"
              >
                {{ rule.events.length }} 个事件
              </UBadge>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <UButton
                :icon="editingRuleId === rule.id ? 'i-lucide-chevron-up' : 'i-lucide-pencil'"
                size="xs"
                color="neutral"
                variant="ghost"
                @click="editingRuleId = editingRuleId === rule.id ? null : rule.id"
              />
              <UButton
                icon="i-lucide-trash-2"
                size="xs"
                color="error"
                variant="ghost"
                @click="removeRule(rule.id)"
              />
            </div>
          </div>

          <!-- 展开编辑 -->
          <template v-if="editingRuleId === rule.id">
            <!-- 飞书群 Chat ID -->
            <div>
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">飞书群 Chat ID</label>
              <UInput
                v-model="rule.chatId"
                placeholder="oc_xxxxxxxxxxxxxxxx"
                size="sm"
              />
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                需要先将飞书机器人添加到目标群聊中，才能发送消息
              </p>
            </div>

            <!-- 事件类型选择 -->
            <div>
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">触发事件</label>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="ev in NOTIFY_EVENTS"
                  :key="ev.value"
                  class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors"
                  :class="rule.events.includes(ev.value)
                    ? 'border-primary-400 bg-primary-50 text-primary-700 dark:border-primary-600 dark:bg-primary-950 dark:text-primary-300'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800'
                  "
                  @click="toggleEvent(rule, ev.value)"
                >
                  <UIcon
                    :name="ev.icon"
                    class="w-3.5 h-3.5"
                  />
                  {{ ev.label }}
                </button>
              </div>
            </div>

            <!-- 分支过滤 -->
            <div>
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">分支过滤</label>
              <UInput
                :model-value="rule.branches.join(', ')"
                placeholder="main, release/*（留空匹配所有）"
                size="sm"
                @update:model-value="rule.branches = parseTags($event)"
              />
            </div>

            <!-- Workflow 过滤 -->
            <div>
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Workflow 过滤</label>
              <UInput
                :model-value="rule.workflows.join(', ')"
                placeholder="deploy.yml, ci.yml（留空匹配所有）"
                size="sm"
                @update:model-value="rule.workflows = parseTags($event)"
              />
            </div>
          </template>

          <!-- 折叠摘要 -->
          <div
            v-else
            class="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-4 gap-y-1"
          >
            <span>
              <UIcon
                name="i-simple-icons-bytedance"
                class="w-3 h-3 mr-0.5 align-text-bottom inline-block"
              />
              {{ rule.chatId || '未设置群' }}
            </span>
            <span v-if="rule.branches.length > 0">
              <UIcon
                name="i-lucide-git-branch"
                class="w-3 h-3 mr-0.5 align-text-bottom inline-block"
              />
              {{ rule.branches.join(', ') }}
            </span>
            <span v-if="rule.workflows.length > 0">
              <UIcon
                name="i-lucide-workflow"
                class="w-3 h-3 mr-0.5 align-text-bottom inline-block"
              />
              {{ rule.workflows.join(', ') }}
            </span>
          </div>
        </div>
      </div>

      <div
        v-else
        class="text-center py-8 text-sm text-gray-400"
      >
        <UIcon
          name="i-lucide-bell-off"
          class="w-8 h-8 mx-auto mb-2"
        />
        <p>暂无通知规则</p>
        <p class="text-xs mt-1">
          未配置规则时，仅 Action/Agent 通知会私信组织成员
        </p>
      </div>
    </UCard>

    <!-- 其他飞书设置 -->
    <UCard>
      <template #header>
        <h3 class="font-semibold">
          其他设置
        </h3>
      </template>
      <div class="space-y-5">
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-sm">
              部署审批
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              通过飞书机器人 /deploy 时需要审批通过
            </p>
          </div>
          <USwitch v-model="settingsForm.approvalRequired" />
        </div>

        <div class="flex justify-end pt-2">
          <UButton
            color="primary"
            :loading="savingSettings"
            @click="saveSettings"
          >
            保存设置
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- Watch 同步 -->
    <UCard>
      <template #header>
        <h3 class="font-semibold">
          Watch 同步
        </h3>
      </template>
      <div class="flex items-center justify-between gap-4">
        <div class="text-sm text-gray-500 dark:text-gray-400">
          <p>
            当前状态：{{ watchState.watching ? "Watching" : "Not Watching" }}
          </p>
          <p class="mt-1">
            上次同步：
            {{ watchState.watchSyncedAt ? new Date(watchState.watchSyncedAt).toLocaleString("zh-CN") : "未同步" }}
          </p>
        </div>
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="soft"
          :loading="syncingWatch"
          @click="syncWatchState"
        >
          同步状态
        </UButton>
      </div>
    </UCard>

    <!-- 危险操作 -->
    <UCard>
      <template #header>
        <h3 class="font-semibold text-red-600 dark:text-red-400">
          危险操作
        </h3>
      </template>
      <div class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          删除项目将移除项目相关记录，但不会修改系统级 Webhook 配置，此操作不可恢复。
        </p>
        <div>
          <p class="text-sm mb-2">
            请输入项目名称
            <strong>{{ project.full_name }}</strong> 以确认删除：
          </p>
          <div class="flex gap-2">
            <UInput
              v-model="confirmDeleteName"
              :placeholder="project.full_name"
              size="sm"
              class="flex-1"
            />
            <UButton
              color="error"
              variant="soft"
              :loading="deleting"
              :disabled="confirmDeleteName !== project.full_name"
              @click="deleteProject"
            >
              删除项目
            </UButton>
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
