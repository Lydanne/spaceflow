import { defineCardPage } from "~~/server/card-kit";

export default defineCardPage({
  name: "help",

  async render(ctx) {
    return ctx
      .card({ title: "🤖 Teax Bot 帮助", theme: "blue" })
      .text(
        [
          "**📋 仓库与构建**",
          "`/repos [org]` — 列出已注册的仓库",
          "`/orgs` — 查看我所属的组织",
          "`/status <owner/repo>` — 查询构建状态",
          "`/actions <owner/repo>` — 触发工作流",
          "",
          "**🚀 工作流预设**",
          "`/run <token>` — 通过预设 Token 触发工作流",
          "`/presets` — 查看工作流预设",
          "",
          "**👤 账户与设置**",
          "`/account` — 查看账户信息（多账户可切换）",
          "`/notify` — 查看通知设置",
          "",
          "**📝 审批**",
          "`/approvals` — 查看待处理审批",
          "",
          "**🧪 测试**",
          "`/test-form` — 测试飞书卡片表单组件",
          "",
          "**💡 提示**",
          "直接 @ 机器人或发送预设链接可触发工作流",
        ].join("\n"),
        true,
      )
      .systemButtons()
      .build();
  },
});
