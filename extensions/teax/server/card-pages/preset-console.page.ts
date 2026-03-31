import {
  defineCardPage,
  navigate,
  asyncTask,
  toast,
  EnhancedCardBuilder,
  requireBinding,
} from "~~/server/card-kit";
import { resolvePresetByShareToken } from "~~/server/utils/resolve-preset";
import { useGiteaSdk, botLogin } from "~~/server/utils/gitea";
import {
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
  getLockerDisplayName,
  unlockPresetByShareToken,
} from "~~/server/services/preset-run.service";
import { runWorkflowWithPreset } from "~~/server/services/workflow-run.service";
import { getRuntimeVerboseDefault } from "~~/server/utils/verbose";
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
    const verbose = getRuntimeVerboseDefault();

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

        const gitea = await useGiteaSdk(botLogin(ctx.openId)).role("fallback-admin", {
          verbose,
          logTag: "preset-console",
        });
        const inputOverrides = Object.fromEntries(
          Object.entries(formValue as Record<string, unknown>).filter(([key]) => key !== "branch"),
        );
        let runResult: Awaited<ReturnType<typeof runWorkflowWithPreset>>;
        try {
          runResult = await runWorkflowWithPreset({
            preset,
            owner,
            repoName,
            actorId: activeUser.id,
            gitea,
            branchOverride: formValue.branch,
            inputOverrides,
            allowSyncToPreset: true,
          });
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 409) {
            const runNumber = (err as { data?: { run_number?: number } })?.data?.run_number;
            const message = runNumber
              ? `当前有一个正在运行的工作流 (Run #${runNumber})\n请等待完成后再试`
              : ((err as { message?: string })?.message || "当前有一个正在运行的工作流，请等待完成后再试");
            await updateCard(
              new EnhancedCardBuilder(
                { title: "⏳ 工作流运行中", theme: "orange" },
                "",
              )
                .text(message, true)
                .build(),
            );
            return;
          }
          console.error("[preset-console] dispatchWorkflow error:", err);
          await updateCard(buildDispatchErrorCard(err));
          return;
        }

        const {
          runId: newRunId,
          runNumber: newRunNumber,
          finalBranch,
          finalInputs,
          lockInfo,
        } = runResult;

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
            runInputs: finalInputs,
            extraLines,
          }),
        );
      },
    );
  },
});
