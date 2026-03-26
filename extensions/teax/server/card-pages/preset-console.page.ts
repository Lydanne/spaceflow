import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { defineCardPage, navigate, asyncTask, EnhancedCardBuilder, requireBinding } from "~~/server/card-kit";
import { resolvePresetByShareToken } from "~~/server/utils/resolve-preset";
import { useGiteaSdk } from "~~/server/utils/gitea";
import { getActiveAccount } from "~~/server/services/account.service";
import { parseWorkflowYaml, extractInputs, type WorkflowInputDef } from "~~/server/utils/workflow-yaml";
import { queryUserPermissionGroups, rowGrantsPermission } from "~~/server/utils/permission";
import { recordAutoLockHistory, recordTriggerHistory } from "~~/server/services/preset-lock.service";

// --- Helper: permission check without H3Event ---
async function checkUserPermission(userId: string, orgId: string, permission: string, repositoryId?: string): Promise<boolean> {
  const groups = await queryUserPermissionGroups(userId, orgId);
  return groups.some((group) => rowGrantsPermission(group, permission, repositoryId));
}

export default defineCardPage({
  name: "preset:console",

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

    // Fetch input definitions from workflow YAML
    let inputDefs: Record<string, WorkflowInputDef> | null = null;
    try {
      const workflowFileName = preset.workflow_path.split("/").pop() || preset.workflow_path;
      const { workflows } = await gitea.getRepoWorkflows(owner, repoName);
      const wf = workflows.find((w) =>
        w.path === preset.workflow_path
        || w.name === workflowFileName
        || w.name?.replace(/\.ya?ml$/, "") === workflowFileName.replace(/\.ya?ml$/, ""),
      );

      if (wf) {
        const content = await gitea.getFileContent(owner, repoName, preset.workflow_path, preset.branch);
        if (content) {
          const doc = parseWorkflowYaml(content);
          if (doc) {
            inputDefs = extractInputs(doc);
          }
        }
      }
    } catch (err) {
      console.warn("[preset:console] Failed to fetch workflow inputs:", err);
    }

    // Get branches
    let branches: Array<{ label: string; value: string }> = [];
    try {
      const branchList = await gitea.getRepoBranches(owner, repoName);
      branches = branchList.map((b) => ({ label: b.name, value: b.name }));
    } catch (err) {
      console.warn("[preset:console] Failed to fetch branches:", err);
    }

    // Collect locked fields (displayed as read-only)
    const lockedFields: Array<{ label: string; value: string }> = [];

    const card = ctx.card({ title: `🚀 ${preset.name}`, theme: "blue" });

    card.text(`**仓库**: ${repo.full_name}\n**工作流**: ${preset.workflow_path}`, true);
    card.divider();

    // Start form
    card.form("preset_form");

    // Branch selector
    if (branches.length > 0) {
      const defaultFirst = branches.find((b) => b.value === preset.branch);
      const rest = branches.filter((b) => b.value !== preset.branch);
      const sortedBranches = defaultFirst
        ? [defaultFirst, ...rest]
        : branches;
      card.select({
        name: "branch",
        label: "分支",
        placeholder: "选择分支",
        required: true,
        options: sortedBranches,
        initial_option: preset.branch,
      });
    }

    // Process input definitions
    if (inputDefs) {
      const lockedInputs = new Set<string>(preset.locked_inputs || []);

      for (const [key, def] of Object.entries(inputDefs)) {
        if (lockedInputs.has(key)) {
          lockedFields.push({
            label: def.description || key,
            value: String((preset.inputs as Record<string, unknown>)?.[key] ?? def.default ?? "-"),
          });
          continue;
        }

        if (def.type === "choice" && def.options?.length) {
          const defaultValue = def.default != null ? String(def.default) : undefined;
          card.select({
            name: key,
            label: def.description || key,
            placeholder: `选择 ${def.description || key}`,
            required: def.required || false,
            options: def.options.map((o) => ({ label: o, value: o })),
            initial_option: defaultValue,
          });
        } else if (def.type === "boolean") {
          const boolDefault = def.default != null ? (def.default ? "true" : "false") : undefined;
          card.select({
            name: key,
            label: def.description || key,
            placeholder: `选择 ${def.description || key}`,
            required: def.required || false,
            options: [
              { label: "是", value: "true" },
              { label: "否", value: "false" },
            ],
            initial_option: boolDefault,
          });
        } else {
          card.inputV2({
            name: key,
            label: def.description || key,
            placeholder: def.default ? String(def.default) : `输入 ${def.description || key}`,
            required: def.required || false,
            default_value: def.default ? String(def.default) : undefined,
          });
        }
      }
    }

    // Submit button
    card.formButtons({
      submit: { text: "🚀 触发工作流", type: "primary" },
    });

    card.endForm();

    // Locked fields outside form
    if (lockedFields.length > 0) {
      card.divider();
      card.text("**🔒 锁定参数**", true);
      card.fields(lockedFields);
    }

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
      return navigate("preset:console", { shareToken });
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
        const updateCard = ctx.updateCard;

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
        const gitea = await useGiteaSdk().role("admin");
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

        // Get latest run ID for polling
        let latestRunId = 0;
        try {
          const runs = await gitea.getRepoWorkflowRuns(owner, repoName, 1, 5);
          const latestRun = runs.workflow_runs?.find((run) => run.path?.includes(workflowFileName));
          if (latestRun) {
            latestRunId = latestRun.id;
          }
        } catch {
          // Ignore
        }

        // Dispatch workflow
        try {
          await gitea.dispatchWorkflow(owner, repoName, workflowFileName, finalBranch, finalInputs as Record<string, string | number | boolean>);
        } catch (err) {
          console.error("[preset:console] dispatchWorkflow error:", err);
          const errObj = err as { data?: { message?: string }; message?: string };
          const msg = errObj?.data?.message || errObj?.message || "触发工作流失败";
          await updateCard(
            new EnhancedCardBuilder({ title: "❌ 触发失败", theme: "red" }, "")
              .text(msg, true)
              .build(),
          );
          return;
        }

        // Poll for new run ID
        let newRunId: number | null = null;
        let newRunNumber: number | null = null;
        for (let i = 0; i < 10; i++) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          try {
            const runs = await gitea.getRepoWorkflowRuns(owner, repoName, 1, 5);
            const newRun = runs.workflow_runs?.find((run) => {
              return run.path?.includes(workflowFileName) && run.id > latestRunId;
            });
            if (newRun) {
              newRunId = newRun.id;
              newRunNumber = newRun.run_number;
              break;
            }
          } catch {
            // Continue polling
          }
        }

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
        const baseUrl = config.public.appUrl as string;
        const resultCard = new EnhancedCardBuilder(
          {
            title: newRunId ? "✅ 工作流已触发" : "⚠️ 工作流已提交",
            theme: newRunId ? "green" : "orange",
          },
          "",
        );

        const resultLines = [
          `**仓库**: ${repo.full_name}`,
          `**分支**: ${finalBranch}`,
          `**工作流**: ${preset.workflow_path}`,
        ];

        if (newRunId) {
          resultLines.push(`**运行编号**: #${newRunNumber}`);
          resultLines.push(`[查看运行详情](${baseUrl}/${owner}/${repoName}/actions/runs/${newRunId})`);
        }

        if (lockInfo) {
          resultLines.push("");
          const unlockText = lockInfo.auto_unlock_at
            ? new Date(lockInfo.auto_unlock_at).toLocaleString("zh-CN")
            : "手动解锁";
          resultLines.push(`🔒 已自动锁定 (将在 ${unlockText} 解锁)`);
        }

        resultCard.text(resultLines.join("\n"), true);
        await updateCard(resultCard.build());
      },
    );
  },
});
