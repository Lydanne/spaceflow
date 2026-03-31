<script setup lang="ts">
import type {
  WorkflowPresetGroupCardItemDto,
  UserWorkflowPresetSubItemDto,
} from "~~/server/shared/dto";

export type SubPresetItem = UserWorkflowPresetSubItemDto;
export type PresetGroupItem = WorkflowPresetGroupCardItemDto;

const props = withDefaults(defineProps<{
  group: PresetGroupItem;
  mode?: "personal" | "org";
  showDelete?: boolean;
  showPublicToggle?: boolean;
  showCreator?: boolean;
  expandable?: boolean;
  expanded?: boolean;
}>(), {
  mode: "personal",
  showDelete: false,
  showPublicToggle: false,
  showCreator: false,
  expandable: true,
  expanded: undefined,
});

const emit = defineEmits<{
  delete: [group: PresetGroupItem];
  togglePublic: [group: PresetGroupItem];
  "update:expanded": [expanded: boolean];
}>();

const toast = useToast();
const internalExpanded = ref(false);
const isExpanded = computed({
  get: () => props.expanded ?? internalExpanded.value,
  set: (val) => {
    internalExpanded.value = val;
    emit("update:expanded", val);
  },
});

function toggleExpand() {
  if (props.expandable) {
    isExpanded.value = !isExpanded.value;
  }
}

function copyGroupShareUrl() {
  const url = `${window.location.origin}/workflow-groups/${props.group.share_token}`;
  navigator.clipboard.writeText(url);
  toast.add({ title: "链接已复制", color: "success" });
}

function handleDelete() {
  emit("delete", props.group);
}

function handleTogglePublic() {
  emit("togglePublic", props.group);
}

function copySubPresetUrl(subPreset: SubPresetItem) {
  const url = `${window.location.origin}/workflows/${subPreset.share_token}`;
  navigator.clipboard.writeText(url);
  toast.add({ title: "链接已复制", color: "success" });
}
</script>

<template>
  <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
    <!-- 预设组头部 -->
    <div
      class="flex items-center justify-between p-3 transition-colors"
      :class="{ 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50': expandable }"
      @click="toggleExpand"
    >
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <UIcon
          name="i-lucide-folder"
          class="w-5 h-5 text-primary flex-shrink-0"
        />
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-medium truncate">{{ group.name }}</span>
            <UBadge
              v-if="group.is_public !== undefined && showPublicToggle"
              :color="group.is_public ? 'success' : 'neutral'"
              variant="subtle"
              size="xs"
            >
              {{ group.is_public ? "公开" : "私有" }}
            </UBadge>
            <UBadge
              v-if="group.presets"
              color="info"
              variant="subtle"
              size="xs"
            >
              {{ group.presets.length }} 个子预设
            </UBadge>
          </div>
          <p
            v-if="group.description"
            class="text-sm text-gray-600 dark:text-gray-400 mt-0.5 truncate"
          >
            {{ group.description }}
          </p>
          <div class="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span class="flex items-center gap-1">
              <UIcon
                name="i-lucide-git-branch"
                class="w-3.5 h-3.5"
              />
              {{ group.repository.full_name }}
            </span>
            <span class="flex items-center gap-1">
              <UIcon
                name="i-lucide-git-commit"
                class="w-3.5 h-3.5"
              />
              {{ group.default_branch }}
            </span>
            <span class="font-mono truncate max-w-[200px]">
              {{ group.workflow_path.split('/').pop() }}
            </span>
          </div>
          <div
            v-if="showCreator && group.creator"
            class="flex items-center gap-1.5 mt-2 text-xs text-gray-400"
          >
            <UAvatar
              :src="group.creator.avatar_url || undefined"
              :alt="group.creator.gitea_username"
              size="2xs"
            />
            <span>{{ group.creator.gitea_username }}</span>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-1 ml-3">
        <UTooltip text="复制分享链接">
          <UButton
            icon="i-lucide-copy"
            color="neutral"
            variant="ghost"
            size="xs"
            @click.stop="copyGroupShareUrl"
          />
        </UTooltip>
        <UTooltip text="打开预设组页面">
          <UButton
            icon="i-lucide-external-link"
            color="neutral"
            variant="ghost"
            size="xs"
            :to="`/workflow-groups/${group.share_token}`"
            target="_blank"
            @click.stop
          />
        </UTooltip>
        <UTooltip v-if="showPublicToggle" :text="group.is_public ? '设为私有' : '设为公开'">
          <UButton
            :icon="group.is_public ? 'i-lucide-eye-off' : 'i-lucide-eye'"
            color="neutral"
            variant="ghost"
            size="xs"
            @click.stop="handleTogglePublic"
          />
        </UTooltip>
        <UTooltip v-if="showDelete" text="删除预设组">
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="xs"
            @click.stop="handleDelete"
          />
        </UTooltip>
        <UIcon
          v-if="expandable"
          :name="isExpanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          class="w-4 h-4 text-gray-400 ml-2"
        />
      </div>
    </div>

    <!-- 子预设列表 -->
    <div
      v-if="expandable && isExpanded && group.presets"
      class="border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30"
    >
      <div
        v-if="group.presets.length === 0"
        class="p-4 text-center text-sm text-gray-400"
      >
        暂无子预设
      </div>
      <div
        v-else
        class="divide-y divide-gray-200 dark:divide-gray-700"
      >
        <div
          v-for="subPreset in group.presets"
          :key="subPreset.id"
          class="flex items-center justify-between p-3 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
        >
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <span class="text-xs text-gray-400 w-6 text-center">#{{ subPreset.preset_index }}</span>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-medium truncate">{{ subPreset.name }}</span>
                <UBadge
                  v-if="subPreset.locked_by"
                  color="warning"
                  variant="subtle"
                  size="xs"
                >
                  已锁定
                </UBadge>
                <UBadge
                  v-if="subPreset.current_run_id"
                  color="info"
                  variant="subtle"
                  size="xs"
                >
                  运行中
                </UBadge>
              </div>
              <div class="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                <span class="flex items-center gap-1">
                  <UIcon
                    name="i-lucide-git-commit"
                    class="w-3 h-3"
                  />
                  {{ subPreset.branch }}
                </span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-1 ml-3">
            <UTooltip text="复制分享链接">
              <UButton
                icon="i-lucide-copy"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="copySubPresetUrl(subPreset)"
              />
            </UTooltip>
            <UTooltip text="打开子预设页面">
              <UButton
                icon="i-lucide-external-link"
                color="neutral"
                variant="ghost"
                size="xs"
                :to="`/workflows/${subPreset.share_token}`"
                target="_blank"
              />
            </UTooltip>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
