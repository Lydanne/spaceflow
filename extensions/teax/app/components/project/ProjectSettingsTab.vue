<script setup lang="ts">
const props = defineProps<{
  owner: string;
  repo: string;
  project: {
    id: string;
    full_name: string;
    default_branch: string | null;
    clone_url: string;
    webhook_id: number | null;
    settings: Record<string, unknown>;
  };
}>();

const toast = useToast();

// 通知设置
interface ProjectSettings {
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  feishuChatId: string;
  approvalRequired: boolean;
  notifyBranches: string[];
}

const settingsForm = reactive<ProjectSettings>({
  notifyOnSuccess: true,
  notifyOnFailure: true,
  feishuChatId: "",
  approvalRequired: false,
  notifyBranches: [],
});
const notifyBranchesInput = ref("");
const savingSettings = ref(false);

watch(
  () => props.project.settings,
  (s) => {
    if (!s) return;
    const ps = s as unknown as ProjectSettings;
    settingsForm.notifyOnSuccess = ps.notifyOnSuccess ?? true;
    settingsForm.notifyOnFailure = ps.notifyOnFailure ?? true;
    settingsForm.feishuChatId = ps.feishuChatId ?? "";
    settingsForm.approvalRequired = ps.approvalRequired ?? false;
    settingsForm.notifyBranches = ps.notifyBranches ?? [];
    notifyBranchesInput.value = settingsForm.notifyBranches.join(", ");
  },
  { immediate: true },
);

async function saveSettings() {
  savingSettings.value = true;
  // 解析分支输入为数组
  settingsForm.notifyBranches = notifyBranchesInput.value
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);
  try {
    await $fetch(`/api/repos/${props.owner}/${props.repo}/settings`, {
      method: "PATCH",
      body: { ...settingsForm },
    });
    toast.add({ title: "设置已保存", color: "success" });
  } catch {
    toast.add({ title: "保存失败", color: "error" });
  } finally {
    savingSettings.value = false;
  }
}

// 删除项目
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
            {{
              project.webhook_id
                ? `已配置 (ID: ${project.webhook_id})`
                : "未配置"
            }}
          </p>
        </div>
      </div>
    </UCard>

    <!-- 通知设置 -->
    <UCard>
      <template #header>
        <h3 class="font-semibold">
          通知设置
        </h3>
      </template>
      <div class="space-y-5">
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-sm">
              成功通知
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Actions 运行成功时发送飞书通知
            </p>
          </div>
          <USwitch v-model="settingsForm.notifyOnSuccess" />
        </div>

        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-sm">
              失败通知
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Actions 运行失败时发送飞书通知
            </p>
          </div>
          <USwitch v-model="settingsForm.notifyOnFailure" />
        </div>
      </div>
    </UCard>

    <!-- 飞书集成 -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon
            name="i-simple-icons-lark"
            class="w-4 h-4"
          />
          <h3 class="font-semibold">
            飞书集成
          </h3>
        </div>
      </template>
      <div class="space-y-5">
        <div>
          <label class="block text-sm font-medium mb-1">飞书群 Chat ID</label>
          <UInput
            v-model="settingsForm.feishuChatId"
            placeholder="oc_xxxxxxxxxxxxxxxx"
            size="sm"
          />
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            配置后通知将发送到飞书群，留空则私信通知组织成员
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">通知分支过滤</label>
          <UInput
            v-model="notifyBranchesInput"
            placeholder="main, release/*"
            size="sm"
          />
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            多个分支用逗号分隔，留空表示所有分支都通知
          </p>
        </div>

        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-sm">
              部署审批
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              通过飞书机器人部署时需要审批通过
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

    <!-- 危险操作 -->
    <UCard>
      <template #header>
        <h3 class="font-semibold text-red-600 dark:text-red-400">
          危险操作
        </h3>
      </template>
      <div class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          删除项目将同时移除所有发布记录和 Webhook 配置，此操作不可恢复。
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
