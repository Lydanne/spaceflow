import {
  defineCardPage,
  navigate,
  asyncTask,
  toast,
  EnhancedCardBuilder,
  requireBinding,
} from "~~/server/card-kit";
import { resolvePresetByShareToken } from "~~/server/utils/resolve-preset";
import { useGiteaSdk } from "~~/server/utils/gitea";
import {
  dispatchAndPoll,
  buildDispatchErrorCard,
  buildTriggerResultCard,
  fetchWorkflowFormData,
  renderWorkflowForm,
} from "~~/server/utils/workflow-trigger";
import {
  queryUserPermissionGroups,
  rowGrantsPermission,
} from "~~/server/utils/permission";
import {
  buildRunConfig,
  getLockerDisplayName,
  pickInputOverridesFromForm,
  persistPresetTriggerResult,
  unlockPresetByShareToken,
} from "~~/server/services/preset-run.service";
import type { User } from "~~/server/db/schema";

// --- Helper: permission check without H3Event ---
async function checkUserPermission(
  userId: string,
  orgId: string,
  permission: string,
  repositoryId?: string,
): Promise<boolean> {
  const groups = await queryUserPermissionGroups(userId, orgId);
  return groups.some((group) =>
    rowGrantsPermission(group, permission, repositoryId),
  );
}

export default defineCardPage({
  name: "preset-console",

  beforeEnter: requireBinding(),

  async render(ctx) {
    const shareToken = ctx.params.shareToken as string;
    if (!shareToken) {
      return ctx
        .card({ title: "❌ 参数错误", theme: "red" })
        .text("缺少预设 Token", true)
        .build();
    }

    let resolved: Awaited<ReturnType<typeof resolvePresetByShareToken>>;
    try {
      resolved = await resolvePresetByShareToken(shareToken);
    } catch {
      return ctx
        .card({ title: "❌ 预设不存在", theme: "red" })
        .text("该预设可能已被删除", true)
        .build();
    }
    const { preset, repo, owner, repoName } = resolved;
    const gitea = await useGiteaSdk().role("admin");

    const formData = await fetchWorkflowFormData(gitea, {
      owner,
      repo: repoName,
      workflowPath: preset.workflow_path,
      defaultBranch: preset.branch,
    });

    const card = ctx.card({ title: `🚀 ${preset.name}`, theme: "blue" });
    card.text(
      `**仓库**: ${repo.full_name}\n**工作流**: ${preset.workflow_path}`,
      true,
    );
    card.divider();

    const activeUser = ctx.inject<User>(requireBinding);
    const activeUserId = activeUser?.id;
    const isLockedByOther = !!(
      preset.group_id
      && preset.locked_by
      && preset.locked_by !== activeUserId
    );

    const lockedInputs = new Set<string>(preset.locked_inputs || []);
    if (isLockedByOther && formData.inputDefs) {
      for (const inputKey of Object.keys(formData.inputDefs)) {
        lockedInputs.add(inputKey);
      }
    }
    if (!preset.allow_input_override && formData.inputDefs) {
      for (const inputKey of Object.keys(formData.inputDefs)) {
        lockedInputs.add(inputKey);
      }
    }
    renderWorkflowForm(card, formData, {
      formName: "preset_form",
      disableBranch: isLockedByOther || !preset.allow_branch_override,
      disableBranchReason: isLockedByOther
        ? "🔒 当前预设被他人锁定，仅锁定者可修改"
        : "🔒 该预设不允许修改分支",
      lockedInputs,
      lockedValues: preset.inputs as Record<string, unknown>,
      initialValues: preset.inputs as Record<string, unknown>,
    });

    // 锁定状态提示
    if (preset.group_id && preset.locked_by) {
      card.divider();
      if (preset.locked_by === activeUserId) {
        const unlockText = preset.auto_unlock_at
          ? `自动解锁: ${new Date(preset.auto_unlock_at).toLocaleString("zh-CN")}`
          : "手动解锁";
        card.text(`🔒 已锁定（${unlockText}）`, true);
      } else {
        const lockerName = await getLockerDisplayName(preset.locked_by);
        card.text(`🔒 已被 **${lockerName}** 锁定`, true);
      }
    }

    // 底部按钮
    const config = useRuntimeConfig();
    const presetUrl = `${config.public.appUrl}/workflows/${preset.share_token}`;

    const extra: Parameters<typeof card.systemButtons>[0] = [];
    if (preset.group_id && preset.locked_by === activeUserId) {
      extra.push({ text: "🔓 解锁", type: "danger", action: "unlock" });
    }
    extra.push({ text: " 查看详情", url: presetUrl });
    card.systemButtons(extra);

    return card.build();
  },

  async onAction(ctx) {
    const shareToken = ctx.params.shareToken as string;
    const activeUser = ctx.inject<User>(requireBinding);
    const activeUserId = activeUser?.id;

    // 处理解锁操作
    if (ctx.action === "unlock") {
      if (!activeUserId) return navigate("preset-console", { shareToken });
      await unlockPresetByShareToken(shareToken);

      return toast("success", "✅ 已解锁");
    }

    const formValue = ctx.formValue || {};
    if (!activeUser) {
      return navigate("preset-console", { shareToken });
    }

    // 1. Resolve preset（用于展示基础信息）
    let initialResolved: Awaited<ReturnType<typeof resolvePresetByShareToken>>;
    try {
      initialResolved = await resolvePresetByShareToken(shareToken);
    } catch {
      return navigate("preset-console", { shareToken });
    }
    const { preset: initialPreset, repo: initialRepo } = initialResolved;

    // 3. Return AsyncTaskResult
    return asyncTask(
      `**预设**: ${initialPreset.name}\n**仓库**: ${initialRepo.full_name}\n\n⏳ 正在触发工作流，请稍候...`,
      async () => {
        const updateCard = ctx.update;
        let resolved: Awaited<ReturnType<typeof resolvePresetByShareToken>>;
        try {
          resolved = await resolvePresetByShareToken(shareToken);
        } catch {
          await updateCard(
            new EnhancedCardBuilder({ title: "❌ 预设不存在", theme: "red" }, "")
              .text("该预设可能已被删除，请返回重试", true)
              .build(),
          );
          return;
        }

        const { preset, repo, owner, repoName } = resolved;
        const { finalInputs, finalBranch, canModifyOverride } = buildRunConfig({
          preset,
          actorId: activeUser.id,
          branchOverride: formValue.branch,
          inputOverrides: pickInputOverridesFromForm(
            formValue as Record<string, unknown>,
          ),
        });

        // Check permission
        const canTrigger = await checkUserPermission(
          activeUser.id,
          repo.organization_id,
          "actions:trigger",
          repo.id,
        );
        if (!canTrigger) {
          await updateCard(
            new EnhancedCardBuilder({ title: "❌ 无权限", theme: "red" }, "")
              .text("您没有触发此工作流的权限", true)
              .build(),
          );
          return;
        }

        // Check if already running
        const gitea = await useGiteaSdk().role("fallback-admin");
        const workflowFileName
          = preset.workflow_path.split("/").pop() || preset.workflow_path;

        if (preset.current_run_id) {
          try {
            const currentRun = await gitea.getWorkflowRun(
              owner,
              repoName,
              preset.current_run_id,
            );
            const isRunning = [
              "running",
              "waiting",
              "queued",
              "in_progress",
            ].includes(currentRun?.status || "");
            if (isRunning) {
              await updateCard(
                new EnhancedCardBuilder(
                  { title: "⏳ 工作流运行中", theme: "orange" },
                  "",
                )
                  .text(
                    `当前有一个正在运行的工作流 (Run #${currentRun?.run_number})\n请等待完成后再试`,
                    true,
                  )
                  .build(),
              );
              return;
            }
          } catch {
            // Run may have been deleted, continue
          }
        }

        // Dispatch + poll for new run
        let result;
        try {
          result = await dispatchAndPoll(gitea, {
            owner,
            repo: repoName,
            workflowFileName,
            branch: finalBranch,
            inputs: finalInputs as Record<string, string | number | boolean>,
          });
        } catch (err) {
          console.error("[preset-console] dispatchWorkflow error:", err);
          await updateCard(buildDispatchErrorCard(err));
          return;
        }

        const { runId: newRunId, runNumber: newRunNumber } = result;

        let lockInfo: {
          locked_by: string;
          locked_at: string;
          auto_unlock_at: string | null;
        } | null = null;

        if (newRunId) {
          const persistInputs: Record<string, unknown> = { ...finalInputs };
          const persistedBranch = preset.allow_sync_override
            && canModifyOverride
            && preset.allow_branch_override
            ? finalBranch
            : preset.branch;
          const persistedInputs = preset.allow_sync_override
            && canModifyOverride
            && preset.allow_input_override
            ? (persistInputs as Record<string, string | boolean | number>)
            : preset.inputs;

          const persistResult = await persistPresetTriggerResult({
            preset: {
              ...preset,
              branch: persistedBranch,
              inputs: persistedInputs,
            },
            actorId: activeUser.id,
            runId: newRunId,
            runNumber: newRunNumber,
            branch: finalBranch,
            inputs: persistInputs,
            syncBranchToPreset: persistedBranch !== preset.branch
              ? persistedBranch
              : undefined,
            syncInputsToPreset: persistedInputs !== preset.inputs
              ? (persistedInputs as Record<string, unknown>)
              : undefined,
          });
          lockInfo = persistResult.lock_info;
        }

        // Build result card
        const extraLines: string[] = [];
        if (lockInfo) {
          extraLines.push("");
          const unlockText = lockInfo.auto_unlock_at
            ? new Date(lockInfo.auto_unlock_at).toLocaleString("zh-CN")
            : "手动解锁";
          extraLines.push(`🔒 已自动锁定 (将在 ${unlockText} 解锁)`);
        }

        await updateCard(
          buildTriggerResultCard({
            repoFullName: repo.full_name,
            branch: finalBranch,
            workflowPath: preset.workflow_path,
            runId: newRunId,
            runNumber: newRunNumber,
            extraLines,
          }),
        );
      },
    );
  },
});
