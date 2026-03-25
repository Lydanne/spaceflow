/**
 * 注册飞书机器人链接处理器
 *
 * 当用户在飞书中发送包含特定链接的消息时（如 @机器人 + 预设链接），
 * 自动识别并响应。
 *
 * 新增链接处理器只需在此文件中添加 registerLinkRoute 调用。
 */

import { registerLinkRoute } from "~~/server/utils/link-handler";

// ─── 预设链接: /workflows/{token} ───────────────────────────

registerLinkRoute(
  /\/workflows\/([a-zA-Z0-9_-]+)/,
  "preset-console",
  async (ctx) => {
    const token = ctx.match[1]!;
    try {
      const { cardRouter, ensurePages } = await import("~~/server/card-kit");
      await ensurePages();
      const card = await cardRouter.dispatch({
        openId: ctx.senderOpenId,
        actionValue: JSON.stringify({
          __page: "preset:console",
          __params: { shareToken: token },
        }),
        token: "",
        updateCard: async () => {},
      });
      if (card) {
        await replyFeishuCardMessage(ctx.messageId, card);
      }
      return true;
    } catch (err) {
      console.error("[link-handler] preset-console error:", err);
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404) {
        await replyFeishuMessage(ctx.messageId, "❌ 预设不存在或已被删除");
      } else {
        const msg = (err as { message?: string }).message || "获取预设信息失败";
        await replyFeishuMessage(ctx.messageId, `❌ ${msg}`);
      }
      return true;
    }
  },
);

// ─── 未来可在此添加更多链接处理器 ───────────────────────────
// registerLinkRoute(
//   /\/workflow-groups\/([a-zA-Z0-9_-]+)/,
//   "preset-group-console",
//   async (ctx) => { ... },
// );
