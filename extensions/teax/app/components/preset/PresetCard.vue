<script setup lang="ts">
import type { WorkflowPresetCardItemDto } from "~~/server/shared/dto";

export type PresetItem = WorkflowPresetCardItemDto;

const props = withDefaults(defineProps<{
  preset: PresetItem;
  mode?: "personal" | "org";
  showDelete?: boolean;
  showPublicToggle?: boolean;
  showCreator?: boolean;
}>(), {
  mode: "personal",
  showDelete: false,
  showPublicToggle: false,
  showCreator: false,
});

const emit = defineEmits<{
  delete: [preset: PresetItem];
  togglePublic: [preset: PresetItem];
}>();

const toast = useToast();

function copyShareUrl() {
  const url = `${window.location.origin}/workflows/${props.preset.share_token}`;
  navigator.clipboard.writeText(url);
  toast.add({ title: "链接已复制", color: "success" });
}

function handleDelete() {
  emit("delete", props.preset);
}

function handleTogglePublic() {
  emit("togglePublic", props.preset);
}
</script>

<template>
  <div
    class="flex items-start justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
  >
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <span class="font-medium truncate">{{ preset.name }}</span>
        <UBadge
          v-if="preset.is_public !== undefined && showPublicToggle"
          :color="preset.is_public ? 'success' : 'neutral'"
          variant="subtle"
          size="xs"
        >
          {{ preset.is_public ? "公开" : "私有" }}
        </UBadge>
        <UBadge
          v-if="preset.allow_input_override"
          color="info"
          variant="subtle"
          size="xs"
        >
          可改参数
        </UBadge>
        <UBadge
          v-if="preset.allow_branch_override"
          color="info"
          variant="subtle"
          size="xs"
        >
          可改分支
        </UBadge>
      </div>
      <div class="flex items-center gap-3 mt-1 text-xs text-gray-400">
        <span class="flex items-center gap-1">
          <UIcon
            name="i-lucide-git-branch"
            class="w-3.5 h-3.5"
          />
          {{ preset.repository.full_name }}
        </span>
        <span class="flex items-center gap-1">
          <UIcon
            name="i-lucide-git-commit"
            class="w-3.5 h-3.5"
          />
          {{ preset.branch }}
        </span>
        <span class="font-mono truncate max-w-[200px]">
          {{ preset.workflow_path.split('/').pop() }}
        </span>
      </div>
      <div
        v-if="showCreator && preset.creator"
        class="flex items-center gap-1.5 mt-2 text-xs text-gray-400"
      >
        <UAvatar
          :src="preset.creator.avatar_url || undefined"
          :alt="preset.creator.gitea_username"
          size="2xs"
        />
        <span>{{ preset.creator.gitea_username }}</span>
      </div>
    </div>
    <div class="flex items-center gap-1 ml-3">
      <UTooltip text="复制分享链接">
        <UButton
          icon="i-lucide-copy"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="copyShareUrl"
        />
      </UTooltip>
      <UTooltip text="打开预设页面">
        <UButton
          icon="i-lucide-external-link"
          color="neutral"
          variant="ghost"
          size="xs"
          :to="`/workflows/${preset.share_token}`"
          target="_blank"
        />
      </UTooltip>
      <UTooltip v-if="showPublicToggle" :text="preset.is_public ? '设为私有' : '设为公开'">
        <UButton
          :icon="preset.is_public ? 'i-lucide-eye-off' : 'i-lucide-eye'"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="handleTogglePublic"
        />
      </UTooltip>
      <UTooltip v-if="showDelete" text="删除预设">
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          size="xs"
          @click="handleDelete"
        />
      </UTooltip>
    </div>
  </div>
</template>
