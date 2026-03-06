<script setup lang="ts">
import type { Ref } from "vue";

const NOTIFY_EVENTS = [
  { value: "workflow_success", label: "Action 成功", icon: "i-lucide-check-circle" },
  { value: "workflow_failure", label: "Action 失败", icon: "i-lucide-x-circle" },
  { value: "push", label: "代码推送", icon: "i-lucide-git-commit" },
  { value: "agent_completed", label: "Agent 完成", icon: "i-lucide-bot" },
  { value: "agent_failed", label: "Agent 失败", icon: "i-lucide-bot" },
] as const;

interface NotifyRule {
  id: string;
  name: string;
  chatId: string;
  events: string[];
  branches: string[];
  workflows: string[];
}

const toast = useToast();
const orgName = inject<string>("orgName")!;
const orgDetailData = inject<Ref<{ data: { settings: Record<string, unknown> } } | null>>("orgDetailData")!;

const orgNotifyRules = ref<NotifyRule[]>([]);
const savingFeishu = ref(false);
const editingRuleId = ref<string | null>(null);

watch(
  () => orgDetailData.value?.data?.settings,
  (s) => {
    if (!s) return;
    const os = s as { notifyRules?: NotifyRule[]; feishuChatId?: string };
    if (os.notifyRules && os.notifyRules.length > 0) {
      orgNotifyRules.value = os.notifyRules.map((r) => ({ ...r }));
    } else if (os.feishuChatId) {
      orgNotifyRules.value = [{
        id: crypto.randomUUID(),
        name: "默认通知",
        chatId: os.feishuChatId,
        events: ["workflow_success", "workflow_failure", "push"],
        branches: [],
        workflows: [],
      }];
    } else {
      orgNotifyRules.value = [];
    }
  },
  { immediate: true },
);

function addOrgRule() {
  const rule: NotifyRule = {
    id: crypto.randomUUID(),
    name: "",
    chatId: "",
    events: [],
    branches: [],
    workflows: [],
  };
  orgNotifyRules.value.push(rule);
  editingRuleId.value = rule.id;
}

function removeOrgRule(id: string) {
  orgNotifyRules.value = orgNotifyRules.value.filter((r) => r.id !== id);
  if (editingRuleId.value === id) editingRuleId.value = null;
}

function toggleOrgEvent(rule: NotifyRule, event: string) {
  const idx = rule.events.indexOf(event);
  if (idx >= 0) rule.events.splice(idx, 1);
  else rule.events.push(event);
}

function parseTags(input: string): string[] {
  return input.split(",").map((s) => s.trim()).filter(Boolean);
}

async function saveFeishuSettings() {
  for (const rule of orgNotifyRules.value) {
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

  savingFeishu.value = true;
  try {
    await $fetch(`/api/orgs/${orgName}/settings`, {
      method: "PATCH",
      body: { notifyRules: orgNotifyRules.value },
    });
    toast.add({ title: "通知规则已保存", color: "success" });
    editingRuleId.value = null;
  } catch {
    toast.add({ title: "保存失败", color: "error" });
  } finally {
    savingFeishu.value = false;
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon
            name="i-simple-icons-bytedance"
            class="w-4 h-4"
          />
          <h3 class="font-semibold">
            组织默认通知规则
          </h3>
        </div>
        <UButton
          icon="i-lucide-plus"
          size="xs"
          color="primary"
          variant="soft"
          @click="addOrgRule"
        >
          添加规则
        </UButton>
      </div>
    </template>

    <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">
      仓库未配置自己的通知规则时，将使用组织的默认规则进行通知。
    </p>

    <!-- 规则列表 -->
    <div
      v-if="orgNotifyRules.length > 0"
      class="space-y-4"
    >
      <div
        v-for="rule in orgNotifyRules"
        :key="rule.id"
        class="border rounded-lg p-4 space-y-3"
        :class="editingRuleId === rule.id
          ? 'border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-950/30'
          : 'border-gray-200 dark:border-gray-800'
        "
      >
        <!-- 规则头部 -->
        <div class="flex items-center justify-between gap-2">
          <div
            v-if="editingRuleId === rule.id"
            class="flex-1"
          >
            <UInput
              v-model="rule.name"
              placeholder="规则名称，如：全组织告警"
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
              @click="removeOrgRule(rule.id)"
            />
          </div>
        </div>

        <!-- 展开编辑 -->
        <template v-if="editingRuleId === rule.id">
          <div>
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">飞书群 Chat ID</label>
            <UInput
              v-model="rule.chatId"
              placeholder="oc_xxxxxxxxxxxxxxxx"
              size="sm"
            />
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
              需要先将飞书机器人添加到目标群聊中
            </p>
          </div>

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
                @click="toggleOrgEvent(rule, ev.value)"
              >
                <UIcon
                  :name="ev.icon"
                  class="w-3.5 h-3.5"
                />
                {{ ev.label }}
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">分支过滤</label>
            <UInput
              :model-value="rule.branches.join(', ')"
              placeholder="main, release/*（留空匹配所有）"
              size="sm"
              @update:model-value="rule.branches = parseTags($event)"
            />
          </div>

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
      <p>暂无默认通知规则</p>
      <p class="text-xs mt-1">
        未配置时，仓库将使用自己的规则或私信通知成员
      </p>
    </div>

    <div class="flex justify-end pt-4">
      <UButton
        color="primary"
        :loading="savingFeishu"
        @click="saveFeishuSettings"
      >
        保存规则
      </UButton>
    </div>
  </UCard>
</template>
