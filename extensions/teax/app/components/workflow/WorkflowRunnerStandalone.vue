<script setup lang="ts">
import {
  jobStatusColor,
  jobStatusIcon,
  overallStatusLabel,
  formatDuration,
} from "~/composables/useWorkflowStatus";
import {
  actionLabel,
  actionIcon,
  actionColor,
  formatHistoryTime,
} from "~/composables/usePresetHistory";
import type { WorkflowRunnerContext } from "./useWorkflowRunnerContext";

const props = defineProps<{
  ctx: WorkflowRunnerContext;
}>();

const {
  data,
  isSubPreset,
  statusData,
  lockState,
  isLocking,
  isUnlocking,
  lockPreset,
  unlockPreset,
  historyData,
  loadingHistory,
  showHistory,
  toggleHistory,
  overrideInputs,
  overrideBranch,
  hasEditableInputs,
  openEditInputsModal,
  isTriggering,
  triggerRun,
} = props.ctx;

// 状态图标样式类
function statusIconClass(status: string, conclusion: string | null): string {
  const color = jobStatusColor(status, conclusion);
  if (color === "info") return "text-blue-500";
  if (color === "warning") return "text-amber-500 animate-spin";
  if (color === "success") return "text-green-500";
  if (color === "error") return "text-red-500";
  return "text-gray-400";
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-8">
    <!-- 头部 -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <NuxtLink
          v-if="data.group"
          :to="`/workflow-groups/${data.group.share_token}`"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <UIcon
            name="i-lucide-arrow-left"
            class="w-5 h-5"
          />
        </NuxtLink>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
              {{ data.preset.name }}
            </h1>
            <!-- 锁定状态徽章 -->
            <template v-if="isSubPreset && lockState">
              <UBadge
                color="warning"
                variant="subtle"
              >
                <UIcon
                  name="i-lucide-lock"
                  class="w-3 h-3 mr-1"
                />
                已锁定
                <span
                  v-if="lockState.auto_unlock_at"
                  class="ml-1 opacity-75"
                >
                  · {{ new Date(lockState.auto_unlock_at).toLocaleTimeString() }}
                </span>
              </UBadge>
            </template>
          </div>
          <p class="text-sm text-gray-500 font-mono mt-0.5">
            {{ data.preset.workflow_path }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <!-- 锁定/解锁按钮 -->
        <template v-if="isSubPreset">
          <UButton
            v-if="lockState"
            variant="outline"
            color="warning"
            icon="i-lucide-unlock"
            :loading="isUnlocking"
            @click="unlockPreset"
          >
            解锁
          </UButton>
          <UButton
            v-else
            variant="outline"
            color="neutral"
            icon="i-lucide-lock"
            :loading="isLocking"
            @click="lockPreset"
          >
            锁定
          </UButton>
        </template>
        <!-- 运行按钮 -->
        <UButton
          size="lg"
          color="primary"
          :icon="statusData?.hasRunning ? 'i-lucide-loader' : 'i-lucide-play'"
          :loading="isTriggering"
          :disabled="statusData?.hasRunning"
          @click="triggerRun"
        >
          {{ statusData?.hasRunning ? "运行中..." : "运行工作流" }}
        </UButton>
      </div>
    </div>

    <!-- 左右分栏主体 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- 左侧：配置区 (2/3) -->
      <div class="lg:col-span-2 space-y-6">
        <!-- 分支配置 -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-git-branch"
                class="w-4 h-4 text-gray-400"
              />
              <span class="font-medium">分支</span>
            </div>
          </template>
          <div>
            <USelect
              v-if="data.preset.allow_branch_override && data.branches.length > 0"
              v-model="overrideBranch"
              :items="data.branches.map((b) => ({ label: b, value: b }))"
              value-key="value"
              size="lg"
              class="w-full"
            />
            <div
              v-else
              class="flex items-center gap-2 py-2"
            >
              <UIcon
                name="i-lucide-git-branch"
                class="w-4 h-4 text-gray-400"
              />
              <span class="font-mono text-gray-900 dark:text-white">
                {{ data.preset.branch }}
              </span>
              <UBadge
                variant="subtle"
                color="neutral"
                size="xs"
              >
                固定
              </UBadge>
            </div>
          </div>
        </UCard>

        <!-- 参数配置 -->
        <UCard v-if="Object.keys(data.preset.inputs || {}).length > 0">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon
                  name="i-lucide-settings"
                  class="w-4 h-4 text-gray-400"
                />
                <span class="font-medium">运行参数</span>
              </div>
              <UButton
                v-if="hasEditableInputs"
                size="xs"
                variant="ghost"
                color="primary"
                icon="i-lucide-pencil"
                @click="openEditInputsModal"
              >
                修改参数
              </UButton>
            </div>
          </template>
          <div class="divide-y divide-gray-100 dark:divide-gray-800">
            <div
              v-for="(value, key) in data.preset.inputs"
              :key="key"
              class="py-3 first:pt-0 last:pb-0"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {{ key }}
                    </span>
                    <UBadge
                      v-if="data.preset.locked_inputs?.includes(key as string)"
                      variant="subtle"
                      color="neutral"
                      size="xs"
                    >
                      <UIcon
                        name="i-lucide-lock"
                        class="w-3 h-3 mr-0.5"
                      />
                      锁定
                    </UBadge>
                  </div>
                  <p
                    v-if="data.inputDefs[key]?.description"
                    class="text-xs text-gray-400 mt-0.5"
                  >
                    {{ data.inputDefs[key].description }}
                  </p>
                </div>
                <code class="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono text-gray-900 dark:text-white max-w-[200px] truncate">
                  {{ overrideInputs[key] ?? value }}
                </code>
              </div>
            </div>
          </div>
        </UCard>

        <!-- 运行状态（详细） -->
        <UCard v-if="statusData?.run">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon
                  :name="jobStatusIcon(statusData.run.status, statusData.run.conclusion)"
                  class="w-5 h-5"
                  :class="statusIconClass(statusData.run.status, statusData.run.conclusion)"
                />
                <span class="font-medium">运行 #{{ statusData.run.run_number }}</span>
                <UBadge
                  :color="jobStatusColor(statusData.run.status, statusData.run.conclusion) as any"
                  variant="subtle"
                >
                  {{ overallStatusLabel(statusData.run.status, statusData.run.conclusion) }}
                </UBadge>
              </div>
              <div class="flex items-center gap-3">
                <span
                  v-if="formatDuration(statusData.run.started_at, statusData.run.completed_at)"
                  class="text-sm text-gray-400"
                >
                  {{ formatDuration(statusData.run.started_at, statusData.run.completed_at) }}
                </span>
                <UButton
                  v-if="statusData.run.html_url"
                  :to="statusData.run.html_url"
                  external
                  target="_blank"
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-external-link"
                >
                  详情
                </UButton>
              </div>
            </div>
          </template>

          <!-- 触发者 -->
          <div
            v-if="statusData.triggeredBy"
            class="flex items-center gap-2 text-sm text-gray-500 mb-4"
          >
            <UAvatar
              :src="statusData.triggeredBy.avatar_url || undefined"
              :alt="statusData.triggeredBy.name"
              size="xs"
            />
            <span>{{ statusData.triggeredBy.name }} 触发</span>
          </div>

          <!-- Jobs 列表 -->
          <div
            v-if="statusData.run.jobs.length > 0"
            class="space-y-2"
          >
            <div
              v-for="job in statusData.run.jobs"
              :key="job.id"
              class="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
            >
              <UIcon
                :name="jobStatusIcon(job.status, job.conclusion)"
                class="w-4 h-4 shrink-0"
                :class="statusIconClass(job.status, job.conclusion)"
              />
              <span class="flex-1 text-sm">{{ job.name }}</span>
              <span
                v-if="formatDuration(job.started_at, job.completed_at)"
                class="text-xs text-gray-400"
              >
                {{ formatDuration(job.started_at, job.completed_at) }}
              </span>
            </div>
          </div>
        </UCard>
      </div>

      <!-- 右侧：状态/日志区 (1/3) -->
      <div class="space-y-6">
        <!-- 快速状态卡片 -->
        <UCard
          :class="{
            'border-l-4 border-l-blue-500': !statusData?.run,
            'border-l-4 border-l-amber-500': statusData?.run && statusData.hasRunning,
            'border-l-4 border-l-green-500': statusData?.run && statusData.run.conclusion === 'success',
            'border-l-4 border-l-red-500': statusData?.run && statusData.run.conclusion === 'failure',
          }"
        >
          <div class="text-center py-2">
            <UIcon
              v-if="!statusData?.run"
              name="i-lucide-circle-dot"
              class="w-8 h-8 text-gray-300 mx-auto mb-2"
            />
            <UIcon
              v-else
              :name="jobStatusIcon(statusData.run.status, statusData.run.conclusion)"
              class="w-8 h-8 mx-auto mb-2"
              :class="statusIconClass(statusData.run.status, statusData.run.conclusion)"
            />
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ statusData?.run ? overallStatusLabel(statusData.run.status, statusData.run.conclusion) : '就绪' }}
            </p>
            <p class="text-xs text-gray-400 mt-1">
              {{ statusData?.run ? `运行 #${statusData.run.run_number}` : '等待触发' }}
            </p>
          </div>
        </UCard>

        <!-- 操作日志 -->
        <UCard v-if="isSubPreset">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon
                  name="i-lucide-history"
                  class="w-4 h-4 text-gray-400"
                />
                <span class="font-medium">操作日志</span>
              </div>
              <UButton
                v-if="!showHistory"
                size="xs"
                variant="ghost"
                color="neutral"
                @click="toggleHistory"
              >
                加载
              </UButton>
            </div>
          </template>

          <!-- 加载中 -->
          <div
            v-if="loadingHistory"
            class="flex items-center justify-center py-6"
          >
            <UIcon
              name="i-lucide-loader"
              class="w-5 h-5 animate-spin text-gray-400"
            />
          </div>

          <!-- 历史列表 -->
          <div
            v-else-if="showHistory && historyData.length > 0"
            class="space-y-3 max-h-80 overflow-y-auto"
          >
            <div
              v-for="item in historyData"
              :key="item.id"
              class="flex items-start gap-2"
            >
              <UIcon
                :name="actionIcon(item.action)"
                class="w-4 h-4 mt-0.5 shrink-0"
                :class="actionColor(item.action)"
              />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="text-sm font-medium">{{ actionLabel(item.action) }}</span>
                </div>
                <div class="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                  <span v-if="item.actor_name">{{ item.actor_name }}</span>
                  <span>·</span>
                  <span>{{ formatHistoryTime(item.created_at) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div
            v-else-if="showHistory"
            class="text-center text-sm text-gray-400 py-6"
          >
            暂无操作记录
          </div>

          <!-- 未加载提示 -->
          <div
            v-else
            class="text-center text-sm text-gray-400 py-6"
          >
            点击加载查看历史
          </div>
        </UCard>

        <!-- 仓库信息 -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-git-fork"
                class="w-4 h-4 text-gray-400"
              />
              <span class="font-medium">仓库</span>
            </div>
          </template>
          <p class="text-sm font-mono text-gray-600 dark:text-gray-400">
            {{ data.repository.full_name }}
          </p>
        </UCard>
      </div>
    </div>
  </div>
</template>
