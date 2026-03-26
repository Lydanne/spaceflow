import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { defineCardPage, navigate, asyncTask, EnhancedCardBuilder, requireBinding } from "~~/server/card-kit";
import { resolvePresetByShareToken } from "~~/server/utils/resolve-preset";
import { useGiteaSdk } from "~~/server/utils/gitea";
import { dispatchAndPoll, buildDispatchErrorCard, buildTriggerResultCard, fetchWorkflowFormData, renderWorkflowForm } from "~~/server/utils/workflow-trigger";
import { getActiveAccount } from "~~/server/services/account.service";
import { queryUserPermissionGroups, rowGrantsPermission } from "~~/server/utils/permission";
import { recordAutoLockHistory, recordTriggerHistory } from "~~/server/services/preset-lock.service";

// --- Helper: permission check without H3Event ---
async function checkUserPermission(userId: string, orgId: string, permission: string, repositoryId?: string): Promise<boolean> {
  const groups = await queryUserPermissionGroups(userId, orgId);
  return groups.some((group) => rowGrantsPermission(group, permission, repositoryId));
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
    card.text(`**仓库**: ${repo.full_name}\n**工作流**: ${preset.workflow_path}`, true);
    card.divider();

    const lockedInputs = new Set<string>(preset.locked_inputs || []);
    renderWorkflowForm(card, formData, {
      formName: "preset_form",
      lockedInputs,
      lockedValues: preset.inputs as Record<string, unknown>,
    });

    // 底部链接
    const config = useRuntimeConfig();
    const presetUrl = `${config.public.appUrl}/workflows/${preset.share_token}`;
    card.divider();
    card.button("🔗 查看预设详情", { url: presetUrl });

    return card.build();
  },

  async onAction(ctx) {
    const shareToken = ctx.params.shareToken as string;
    const formValue = ctx.formValue || {};

    // 1. Resolve preset
    let resolved: Awaited<ReturnType<typeof resolvePresetByShareToken>>;
    try {
      resolved = await resolvePresetByShareToken(shareToken);
    } catch {
      return navigate("preset-console", { shareToken });
    }
    const { preset, repo, owner, repoName } = resolved;

    // 2. Build final inputs and branch (synchronous)
    const finalInputs: Record<string, unknown> = { ...(preset.inputs as Record<string, unknown>) };
    let finalBranch = preset.branch;

    if (preset.allow_input_override) {
      const lockedInputs = new Set<string>(preset.locked_inputs || []);
      for (const [key, value] of Object.entries(formValue)) {
        if (key === "branch") continue;
        if (lockedInputs.has(key)) continue;
        finalInputs[key] = value;
      }
    }

    if (preset.allow_branch_override && formValue.branch) {
      finalBranch = formValue.branch;
    }

    const openId = ctx.openId;

    // 3. Return AsyncTaskResult
    return asyncTask(
      `**预设**: ${preset.name}\n**仓库**: ${repo.full_name}\n**分支**: ${finalBranch}\n\n⏳ 正在触发工作流，请稍候...`,
      async () => {
        const updateCard = ctx.update;

        // Check user (binding already verified by beforeEnter)
        const activeUser = await getActiveAccount(openId);
        if (!activeUser) return;

        // Check permission
        const canTrigger = await checkUserPermission(activeUser.id, repo.organization_id, "actions:trigger", repo.id);
        if (!canTrigger) {
          await updateCard(
            new EnhancedCardBuilder({ title: "❌ 无权限", theme: "red" }, "")
              .text("您没有触发此工作流的权限", true)
              .build(),
          );
          return;
        }

        // Check lock status
        if (preset.locked_by && preset.locked_by !== activeUser.id) {
          const db = useDB();
          const [locker] = await db
            .select({ name: schema.users.gitea_username })
            .from(schema.users)
            .where(eq(schema.users.id, preset.locked_by))
            .limit(1);
          const lockerName = locker?.name || "未知用户";
          await updateCard(
            new EnhancedCardBuilder({ title: "🔒 预设已锁定", theme: "orange" }, "")
              .text(
                `预设已被 **${lockerName}** 锁定\n\n锁定时间: ${preset.locked_at ? new Date(preset.locked_at).toLocaleString("zh-CN") : "未知"}`,
                true,
              )
              .build(),
          );
          return;
        }

        // Check if already running
        const gitea = await useGiteaSdk().role("fallback-admin");
        const workflowFileName = preset.workflow_path.split("/").pop() || preset.workflow_path;

        if (preset.current_run_id) {
          try {
            const currentRun = await gitea.getWorkflowRun(owner, repoName, preset.current_run_id);
            const isRunning = ["running", "waiting", "queued", "in_progress"].includes(currentRun?.status || "");
            if (isRunning) {
              await updateCard(
                new EnhancedCardBuilder({ title: "⏳ 工作流运行中", theme: "orange" }, "")
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

        // Update database
        const db = useDB();
        const config = useRuntimeConfig();
        let lockInfo: { locked_by: string; locked_at: string; auto_unlock_at: string | null } | null = null;

        if (newRunId) {
          const updateData: Record<string, unknown> = {
            current_run_id: newRunId,
            last_triggered_by: activeUser.id,
          };

          // Auto-lock sub-presets
          if (preset.group_id && !preset.locked_by) {
            const [group] = await db
              .select({ auto_unlock_minutes: schema.workflowPresetGroups.auto_unlock_minutes })
              .from(schema.workflowPresetGroups)
              .where(eq(schema.workflowPresetGroups.id, preset.group_id))
              .limit(1);

            const now = new Date();
            const autoUnlockAt = group?.auto_unlock_minutes
              ? new Date(now.getTime() + group.auto_unlock_minutes * 60 * 1000)
              : null;

            updateData.locked_by = activeUser.id;
            updateData.locked_at = now;
            if (autoUnlockAt) {
              updateData.auto_unlock_at = autoUnlockAt;
            }

            lockInfo = {
              locked_by: activeUser.id,
              locked_at: now.toISOString(),
              auto_unlock_at: autoUnlockAt?.toISOString() || null,
            };
          }

          await db
            .update(schema.workflowPresets)
            .set(updateData)
            .where(eq(schema.workflowPresets.id, preset.id));

          // Record history for sub-presets
          if (preset.group_id) {
            await recordTriggerHistory(preset.id, activeUser.id, {
              run_id: newRunId,
              run_number: newRunNumber,
              branch: finalBranch,
              inputs: finalInputs,
            });

            if (lockInfo) {
              await recordAutoLockHistory(preset.id, activeUser.id, lockInfo.auto_unlock_at);
            }
          }
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

        await updateCard(buildTriggerResultCard({
          repoFullName: repo.full_name,
          branch: finalBranch,
          workflowPath: preset.workflow_path,
          runId: newRunId,
          runNumber: newRunNumber,
          extraLines,
        }));
      },
    );
  },
});
