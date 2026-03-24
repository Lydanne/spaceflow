/**
 * 飞书卡片更新工具
 * 封装延迟更新卡片的逻辑，支持等待更新完成
 */

import { updateCardMessage } from "~~/server/utils/feishu-sdk";

export type CardData = Record<string, unknown>;
export type UpdateCardFn = (card: CardData) => Promise<void>;

export interface CardUpdater {
  /** 更新卡片的回调函数 */
  updateCard: UpdateCardFn;
  /** 等待卡片更新完成，返回更新后的卡片 */
  waitForUpdate: () => Promise<CardData | undefined>;
}

export interface CardUpdaterOptions {
  /** 更新延迟时间（毫秒），默认 500ms */
  delay?: number;
  /** 超时时间（毫秒），默认 5000ms，超时后自动返回 undefined */
  timeout?: number;
}

/**
 * 创建卡片更新器
 * @param messageId 消息 ID
 * @param options 配置选项
 */
export function createCardUpdater(
  type: "long" | "post",
  messageId: string,
  options: CardUpdaterOptions = {},
): CardUpdater {
  const { delay = 500, timeout = 5000 } = options;

  let resolveUpdate: ((card: CardData | undefined) => void) | undefined;
  let isResolved = false;

  const updatePromise = new Promise<CardData | undefined>((resolve) => {
    resolveUpdate = (card) => {
      if (!isResolved) {
        isResolved = true;
        resolve(card);
      }
    };

    if (type === "post") {
      // 超时自动返回 undefined
      setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          console.log(
            `[feishu-card-updater] ⏰ Timeout waiting for card update (${timeout}ms)`,
          );
          resolve(undefined);
        }
      }, timeout);
    }
  });

  const updateCard: UpdateCardFn = async (card: CardData) => {
    if (type === "long") {
      setTimeout(async () => {
        try {
          await updateCardMessage(messageId, card);
          console.log(
            `[feishu-card-updater] ✅ Card updated for message ${messageId}`,
          );
        } catch (e) {
          console.error("[feishu-card-updater] Failed to update card:", e);
        }
      }, delay);
    } else {
      resolveUpdate?.(card);
    }
  };

  const waitForUpdate = () => updatePromise;

  return { updateCard, waitForUpdate };
}
