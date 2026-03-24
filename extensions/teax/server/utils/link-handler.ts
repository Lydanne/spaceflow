/**
 * 链接处理器注册表
 *
 * 支持通过 URL 模式路由消息到不同的处理逻辑。
 * 例如: /workflows/{token} → 预设控制台卡片
 *       /workflow-groups/{token} → 预设组操作 (未来)
 */

export interface LinkHandlerContext {
  text: string;
  match: RegExpMatchArray;
  senderOpenId: string;
  messageId: string;
  chatId: string;
  chatType: string;
}

export type LinkHandlerFn = (
  ctx: LinkHandlerContext,
) => Promise<boolean>; // return true = handled, false = pass to next

interface LinkRoute {
  pattern: RegExp;
  name: string;
  handler: LinkHandlerFn;
}

const linkRoutes: LinkRoute[] = [];

/**
 * 注册一个链接处理器
 */
export function registerLinkRoute(
  pattern: RegExp,
  name: string,
  handler: LinkHandlerFn,
): void {
  linkRoutes.push({ pattern, name, handler });
}

/**
 * 按注册顺序匹配并执行链接处理器
 * @returns true if any handler processed the message
 */
export async function handleLinkMessage(ctx: Omit<LinkHandlerContext, "match">): Promise<boolean> {
  for (const route of linkRoutes) {
    const match = ctx.text.match(route.pattern);
    if (match) {
      try {
        const handled = await route.handler({ ...ctx, match });
        if (handled) {
          return true;
        }
      } catch (err) {
        console.error(`[link-handler] Error in route "${route.name}":`, err);
      }
    }
  }
  return false;
}

/**
 * 检查文本是否匹配任何已注册的链接模式（不执行处理器）
 * 用于在 longconnection 层快速判断 post 消息是否需要处理
 */
export function hasLinkRouteMatch(text: string): boolean {
  return linkRoutes.some((route) => route.pattern.test(text));
}
