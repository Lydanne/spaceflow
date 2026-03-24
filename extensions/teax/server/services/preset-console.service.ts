import { eq } from "drizzle-orm";
import { FeishuCardBuilder } from "~~/server/utils/feishu-card-builder";
import { resolvePresetByShareToken } from "~~/server/utils/resolve-preset";
import { useGiteaSdk } from "~~/server/utils/gitea";
import { useDB, schema } from "~~/server/db";
import { getActiveAccount } from "~~/server/services/account.service";
import { recordAutoLockHistory, recordTriggerHistory } from "~~/server/services/preset-lock.service";
import { parseWorkflowYaml, extractInputs, type WorkflowInputDef } from "~~/server/utils/workflow-yaml";
import { queryUserPermissionGroups, rowGrantsPermission } from "~~/server/utils/permission";

// --- Helper: permission check without H3Event ---
async function checkUserPermission(userId: string, orgId: string, permission: string, repositoryId?: string): Promise<boolean> {
  const groups = await queryUserPermissionGroups(userId, orgId);
  return groups.some((group) => rowGrantsPermission(group, permission, repositoryId));
}

// --- Error card builders ---
function buildErrorCard(title: string, message: string, theme: "red" | "orange" | "grey" = "red"): Record<string, unknown> {
  return new FeishuCardBuilder({ title, theme }).addText(message, true).build().card;
}

function buildLoadingCard(): Record<string, unknown> {
  return new FeishuCardBuilder({ title: "🚀 触发工作流", theme: "blue" })
    .addText("⏳ 正在触发工作流，请稍候...", true)
    .build().card;
}

// --- Main: Generate Preset Console Card ---
export async function generatePresetConsoleCard(params: {
  openId: string;
  shareToken: string;
}): Promise<Record<string, unknown>> {
  const { preset, repo, owner, repoName } = await resolvePresetByShareToken(params.shareToken);
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
    console.warn("[preset-console] Failed to fetch workflow inputs:", err);
  }

  // Get branches if override is allowed
  let branches: Array<{ label: string; value: string }> = [];
  if (preset.allow_branch_override) {
    try {
      const branchList = await gitea.getRepoBranches(owner, repoName);
      branches = branchList.map((b) => ({ label: b.name, value: b.name }));
    } catch (err) {
      console.warn("[preset-console] Failed to fetch branches:", err);
    }
  }

  // Build card
  const builder = new FeishuCardBuilder({ title: `🚀 ${preset.name}`, theme: "blue" });

  // Preset info
  const infoLines = [
    `**仓库**: ${repo.full_name}`,
    `**工作流**: ${preset.workflow_path}`,
  ];
  if (!preset.allow_branch_override) {
    infoLines.push(`**分支**: ${preset.branch}`);
  }
  builder.addText(infoLines.join("\n"), true);
  builder.addDivider();

  // Branch selector (only if override allowed)
  if (preset.allow_branch_override && branches.length > 0) {
    const defaultFirst = branches.find((b) => b.value === preset.branch)
      ? [branches.find((b) => b.value === preset.branch)!]
      : [];
    const rest = branches.filter((b) => b.value !== preset.branch);
    builder.addSelect({
      name: "branch",
      label: "分支",
      placeholder: "选择分支",
      required: true,
      options: [...defaultFirst, ...rest],
    });
  }

  // Input parameters
  if (inputDefs) {
    if (preset.allow_input_override) {
      const lockedInputs = new Set<string>(preset.locked_inputs || []);

      for (const [key, def] of Object.entries(inputDefs)) {
        if (lockedInputs.has(key)) continue;

        if (def.type === "choice" && def.options?.length) {
          builder.addSelect({
            name: key,
            label: def.description || key,
            placeholder: `选择 ${def.description || key}`,
            required: def.required,
            options: def.options.map((o) => ({ label: o, value: o })),
          });
        } else if (def.type === "boolean") {
          builder.addSelect({
            name: key,
            label: def.description || key,
            placeholder: `选择 ${def.description || key}`,
            required: def.required,
            options: [
              { label: "是", value: "true" },
              { label: "否", value: "false" },
            ],
          });
        } else {
          builder.addInput({
            name: key,
            label: def.description || key,
            placeholder: def.default ? String(def.default) : `输入 ${def.description || key}`,
            required: def.required,
          });
        }
      }
    } else {
      // Read-only display when input override is not allowed
      const fields = Object.entries(inputDefs).map(([key, def]) => ({
        label: def.description || key,
        value: String((preset.inputs as Record<string, unknown>)?.[key] ?? def.default ?? "-"),
      }));

      if (fields.length > 0) {
        builder.addFields(fields);
      }
    }
  }

  // Build card, then add raw trigger button
  const card = builder.build().card;

  // Trigger button — raw element to bypass addButtons value wrapping
  card.elements.push({
    tag: "action",
    actions: [
      {
        tag: "button",
        text: { tag: "plain_text", content: "🚀 触发工作流" },
        type: "primary",
        value: JSON.stringify({
          action: "preset_console_trigger",
          token: params.shareToken,
        }),
      },
    ],
  });

  return card;
}

// --- Main: Handle Preset Console Trigger ---
export async function handlePresetConsoleTrigger(params: {
  openId: string;
  parsedValue: Record<string, unknown>;
  formValue: Record<string, string>;
  updateCard?: (card: Record<string, unknown>) => Promise<void>;
}): Promise<void> {
  const shareToken = params.parsedValue.token as string;
  const formValue = params.formValue;

  // 1. Resolve preset
  let resolved: Awaited<ReturnType<typeof resolvePresetByShareToken>>;
  try {
    resolved = await resolvePresetByShareToken(shareToken);
  } catch {
    if (params.updateCard) {
      await params.updateCard(buildErrorCard("❌ 预设不存在", "该预设可能已被删除"));
    }
    return;
  }
  const { preset, repo, owner, repoName } = resolved;

  // 2. Check user binding
  const activeUser = await getActiveAccount(params.openId);
  if (!activeUser) {
    if (params.updateCard) {
      const config = useRuntimeConfig();
      const baseUrl = config.public.appUrl as string;
      await params.updateCard(
        buildErrorCard(
          "🔗 未绑定账号",
          `请先在 Teax 中绑定飞书账号\n\n[前往绑定](${baseUrl}/user/settings)`,
          "orange",
        ),
      );
    }
    return;
  }

  // 3. Check permission
  const canTrigger = await checkUserPermission(activeUser.id, repo.organization_id, "actions:trigger", repo.id);
  if (!canTrigger) {
    if (params.updateCard) {
      await params.updateCard(buildErrorCard("❌ 无权限", "您没有触发此工作流的权限"));
    }
    return;
  }

  // 4. Check lock status (for sub-presets)
  if (preset.locked_by && preset.locked_by !== activeUser.id) {
    const db = useDB();
    const [locker] = await db
      .select({ name: schema.users.gitea_username })
      .from(schema.users)
      .where(eq(schema.users.id, preset.locked_by))
      .limit(1);
    const lockerName = locker?.name || "未知用户";

    if (params.updateCard) {
      await params.updateCard(
        buildErrorCard(
          "🔒 预设已锁定",
          `预设已被 **${lockerName}** 锁定\n\n锁定时间: ${preset.locked_at ? new Date(preset.locked_at).toLocaleString("zh-CN") : "未知"}`,
          "orange",
        ),
      );
    }
    return;
  }

  // 5. Build final inputs and branch respecting override flags
  const finalInputs: Record<string, unknown> = { ...(preset.inputs as Record<string, unknown> || {}) };
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

  // 6. Update to loading card
  if (params.updateCard) {
    await params.updateCard(buildLoadingCard());
  }

  // 7. Check if already running
  const gitea = await useGiteaSdk().role("admin");
  const workflowFileName = preset.workflow_path.split("/").pop() || preset.workflow_path;

  if (preset.current_run_id) {
    try {
      const currentRun = await gitea.getWorkflowRun(owner, repoName, preset.current_run_id);
      const isRunning = ["running", "waiting", "queued", "in_progress"].includes(currentRun?.status || "");
      if (isRunning) {
        if (params.updateCard) {
          await params.updateCard(
            buildErrorCard(
              "⏳ 工作流运行中",
              `当前有一个正在运行的工作流 (Run #${currentRun?.run_number})\n请等待完成后再试`,
              "orange",
            ),
          );
        }
        return;
      }
    } catch {
      // Run may have been deleted, continue
    }
  }

  // 8. Get latest run ID for polling comparison
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

  // 9. Dispatch workflow
  try {
    await gitea.dispatchWorkflow(owner, repoName, workflowFileName, finalBranch, finalInputs as Record<string, string | number | boolean>);
  } catch (err) {
    console.error("[preset-console] dispatchWorkflow error:", err);
    if (params.updateCard) {
      const errObj = err as { data?: { message?: string }; message?: string };
      const msg = errObj?.data?.message || errObj?.message || "触发工作流失败";
      await params.updateCard(buildErrorCard("❌ 触发失败", msg));
    }
    return;
  }

  // 10. Poll for new run ID (max 10 attempts, 1s interval)
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

  // 11. Update database (current_run_id, auto-lock for sub-presets)
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

  // 12. Build result card
  const baseUrl = config.public.appUrl as string;
  const resultBuilder = new FeishuCardBuilder({
    title: newRunId ? "✅ 工作流已触发" : "⚠️ 工作流已提交",
    theme: newRunId ? "green" : "orange",
  });

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

  resultBuilder.addText(resultLines.join("\n"), true);

  if (params.updateCard) {
    await params.updateCard(resultBuilder.build().card);
  }
}
