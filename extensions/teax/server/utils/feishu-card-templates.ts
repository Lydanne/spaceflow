import { FeishuCardBuilder } from "./feishu-card-builder";

export function buildDeployApprovalCard(data: {
  repository: string;
  branch: string;
  requester: string;
  description: string;
  approvalId: string;
}) {
  return new FeishuCardBuilder({
    title: "🚀 发布审批请求",
    theme: "blue",
  })
    .addText(`**${data.requester}** 请求发布应用`)
    .addDivider()
    .addFields([
      { label: "仓库", value: data.repository },
      { label: "分支", value: data.branch },
      { label: "说明", value: data.description },
    ])
    .addDivider()
    .addButtons([
      {
        text: "✅ 批准",
        value: `approve:${data.approvalId}`,
        type: "primary",
      },
      {
        text: "❌ 拒绝",
        value: `reject:${data.approvalId}`,
        type: "danger",
      },
    ])
    .addConfirm({
      title: "确认操作",
      text: "确定要执行此操作吗？",
    })
    .build();
}

export function buildWorkflowRunCard(data: {
  repository: string;
  workflowName: string;
  branch: string;
  status: "success" | "failure" | "running";
  duration?: string;
  url?: string;
  commit?: {
    sha: string;
    message: string;
    author: string;
  };
}) {
  const statusConfig = {
    success: { title: "✅ 构建成功", theme: "green" as const },
    failure: { title: "❌ 构建失败", theme: "red" as const },
    running: { title: "▶️ 构建中", theme: "blue" as const },
  };

  const config = statusConfig[data.status];
  const builder = new FeishuCardBuilder({
    title: config.title,
    theme: config.theme,
  }).addFields([
    { label: "仓库", value: data.repository },
    { label: "Workflow", value: data.workflowName },
    { label: "分支", value: data.branch },
  ]);

  if (data.duration) {
    builder.addFields([{ label: "耗时", value: data.duration }]);
  }

  if (data.commit) {
    builder.addDivider().addText(
      `**提交**: ${data.commit.sha.substring(0, 7)}\n` +
      `**消息**: ${data.commit.message}\n` +
      `**作者**: ${data.commit.author}`,
      true,
    );
  }

  if (data.url) {
    builder.addDivider().addButtons([
      {
        text: "查看详情",
        value: "view_detail",
        url: data.url,
      },
    ]);
  }

  return builder.build();
}

export function buildPushCard(data: {
  repository: string;
  branch: string;
  pusher: string;
  commits: Array<{
    sha: string;
    message: string;
    author: string;
  }>;
  compareUrl?: string;
}) {
  const builder = new FeishuCardBuilder({
    title: "📝 代码推送",
    theme: "blue",
  })
    .addFields([
      { label: "仓库", value: data.repository },
      { label: "分支", value: data.branch },
      { label: "推送者", value: data.pusher },
      { label: "提交数", value: data.commits.length.toString() },
    ])
    .addDivider();

  const commitList = data.commits
    .slice(0, 5)
    .map(
      (c) => `• \`${c.sha.substring(0, 7)}\` ${c.message} - *${c.author}*`,
    )
    .join("\n");

  builder.addText(commitList, true);

  if (data.commits.length > 5) {
    builder.addText(`...还有 ${data.commits.length - 5} 个提交`, true);
  }

  if (data.compareUrl) {
    builder.addDivider().addButtons([
      {
        text: "查看对比",
        value: "view_compare",
        url: data.compareUrl,
      },
    ]);
  }

  return builder.build();
}

export function buildAgentResultCard(data: {
  agentName: string;
  sessionId: string;
  status: "completed" | "failed";
  duration: string;
  result?: string;
  error?: string;
  prUrl?: string;
}) {
  const builder = new FeishuCardBuilder({
    title:
      data.status === "completed"
        ? "✅ Agent 执行完成"
        : "❌ Agent 执行失败",
    theme: data.status === "completed" ? "green" : "red",
  }).addFields([
    { label: "Agent", value: data.agentName },
    { label: "Session ID", value: data.sessionId },
    { label: "耗时", value: data.duration },
  ]);

  if (data.result) {
    builder.addDivider().addText(`**结果**:\n${data.result}`, true);
  }

  if (data.error) {
    builder.addDivider().addText(`**错误**:\n${data.error}`, true);
  }

  if (data.prUrl) {
    builder.addDivider().addButtons([
      {
        text: "查看 PR",
        value: "view_pr",
        url: data.prUrl,
      },
    ]);
  }

  return builder.build();
}

export function buildApprovalResultCard(data: {
  title: string;
  type: string;
  status: "approved" | "rejected" | "cancelled";
  approver?: string;
  comment?: string;
}) {
  const statusConfig = {
    approved: { title: "✅ 审批通过", theme: "green" as const },
    rejected: { title: "❌ 审批拒绝", theme: "red" as const },
    cancelled: { title: "⚠️ 审批取消", theme: "grey" as const },
  };

  const config = statusConfig[data.status];
  const builder = new FeishuCardBuilder({
    title: config.title,
    theme: config.theme,
  }).addFields([
    { label: "标题", value: data.title },
    { label: "类型", value: data.type },
  ]);

  if (data.approver) {
    builder.addFields([{ label: "审批人", value: data.approver }]);
  }

  if (data.comment) {
    builder.addDivider().addText(`**备注**: ${data.comment}`, true);
  }

  return builder.build();
}
