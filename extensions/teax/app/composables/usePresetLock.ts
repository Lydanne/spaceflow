import type { Ref } from "vue";

export interface LockInfo {
  locked_by: string;
  locked_at: string;
  auto_unlock_at: string | null;
}

export interface UsePresetLockOptions {
  shareToken: string;
  initialLockInfo?: LockInfo | null;
  isSubPreset: Ref<boolean>;
}

export function usePresetLock(options: UsePresetLockOptions) {
  const toast = useToast();

  const isLocking = ref(false);
  const isUnlocking = ref(false);

  // 本地锁定状态（用于覆盖 props，避免直接修改 props）
  const localLockInfo = ref<LockInfo | null>(null);

  // 合并后的锁定状态
  const lockState = computed(() => {
    if (localLockInfo.value) {
      return localLockInfo.value;
    }
    if (options.initialLockInfo) {
      return options.initialLockInfo;
    }
    return null;
  });

  // 当前用户是否锁定了此预设
  const isLockedByMe = computed(() => {
    return !!lockState.value?.locked_by;
  });

  // 更新本地锁定状态
  function updateLockInfo(info: LockInfo | null) {
    localLockInfo.value = info;
  }

  async function lock() {
    if (!options.isSubPreset.value) return;

    isLocking.value = true;
    try {
      await $fetch(`/api/workflow-presets/${options.shareToken}/lock`, {
        method: "POST",
      });
      toast.add({ title: "已锁定预设", color: "success" });
      window.location.reload();
    } catch (err) {
      toast.add({
        title:
          (err as { data?: { message?: string } })?.data?.message || "锁定失败",
        color: "error",
      });
    } finally {
      isLocking.value = false;
    }
  }

  async function unlock() {
    if (!options.isSubPreset.value) return;

    isUnlocking.value = true;
    try {
      await $fetch(`/api/workflow-presets/${options.shareToken}/unlock`, {
        method: "POST",
      });
      toast.add({ title: "已解锁预设", color: "success" });
      window.location.reload();
    } catch (err) {
      toast.add({
        title:
          (err as { data?: { message?: string } })?.data?.message || "解锁失败",
        color: "error",
      });
    } finally {
      isUnlocking.value = false;
    }
  }

  return {
    isLocking,
    isUnlocking,
    lockState,
    isLockedByMe,
    updateLockInfo,
    lock,
    unlock,
  };
}
