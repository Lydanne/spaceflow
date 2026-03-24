import type { Ref } from "vue";

export interface HistoryItem {
  id: string;
  action: string;
  actor_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  actor_name: string | null;
  actor_avatar: string | null;
}

export interface UsePresetHistoryOptions {
  shareToken: string;
  isSubPreset: Ref<boolean>;
}

export function usePresetHistory(options: UsePresetHistoryOptions) {
  const historyData = ref<HistoryItem[]>([]);
  const loadingHistory = ref(false);
  const showHistory = ref(true); // 默认展开

  async function loadHistory() {
    if (!options.isSubPreset.value) return;

    loadingHistory.value = true;
    try {
      const result = await $fetch<{ history: HistoryItem[] }>(
        `/api/workflow-presets/${options.shareToken}/history`,
      );
      historyData.value = result.history;
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      loadingHistory.value = false;
    }
  }

  function toggleHistory() {
    showHistory.value = !showHistory.value;
    if (showHistory.value && historyData.value.length === 0) {
      loadHistory();
    }
  }

  // 自动加载历史
  onMounted(() => {
    if (options.isSubPreset.value) {
      loadHistory();
    }
  });

  // 监听 isSubPreset 变化
  watch(options.isSubPreset, (isSubPreset) => {
    if (isSubPreset && historyData.value.length === 0) {
      loadHistory();
    }
  });

  return {
    historyData,
    loadingHistory,
    showHistory,
    loadHistory,
    toggleHistory,
  };
}

// 操作类型的显示文本
export function actionLabel(action: string): string {
  switch (action) {
    case "lock": return "锁定";
    case "unlock": return "解锁";
    case "trigger": return "触发运行";
    case "create": return "创建";
    case "update": return "更新配置";
    default: return action;
  }
}

// 操作类型的图标
export function actionIcon(action: string): string {
  switch (action) {
    case "lock": return "i-lucide-lock";
    case "unlock": return "i-lucide-unlock";
    case "trigger": return "i-lucide-play";
    case "create": return "i-lucide-plus";
    case "update": return "i-lucide-pencil";
    default: return "i-lucide-activity";
  }
}

// 操作类型的颜色
export function actionColor(action: string): string {
  switch (action) {
    case "lock": return "text-amber-500";
    case "unlock": return "text-green-500";
    case "trigger": return "text-blue-500";
    case "create": return "text-purple-500";
    case "update": return "text-gray-500";
    default: return "text-gray-400";
  }
}

// 格式化历史时间
export function formatHistoryTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}
