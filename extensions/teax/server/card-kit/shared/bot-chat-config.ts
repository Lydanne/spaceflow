import type {
  BotChatConfig,
  ResolveBotChatConfigInput,
} from "../types";

export const DEFAULT_BOT_HOME_PAGE = "cp-home";

export function parseBotChatConfigFromDescription(description?: string): Partial<BotChatConfig> {
  if (!description) {
    return {};
  }

  const match = description.match(/\{([^{}]+)\}/);
  if (!match?.[1]) {
    return {};
  }

  const result: Partial<BotChatConfig> = {};
  const pairs = match[1].split("&");

  for (const pair of pairs) {
    const [rawKey, ...rest] = pair.split("=");
    const key = rawKey?.trim();
    const value = rest.join("=").trim();
    if (!key || !value) {
      continue;
    }

    if (key === "atPageHome") {
      result.atPageHome = value;
      continue;
    }

    if (key === "allowCommand") {
      const normalized = value.toLowerCase();
      if (["true", "1", "yes", "on"].includes(normalized)) {
        result.allowCommand = true;
      } else if (["false", "0", "no", "off"].includes(normalized)) {
        result.allowCommand = false;
      }
    }
  }

  return result;
}

export async function resolveBotChatConfig(
  input: ResolveBotChatConfigInput,
): Promise<BotChatConfig> {
  if (input.chatType !== "group") {
    return {
      atPageHome: DEFAULT_BOT_HOME_PAGE,
      allowCommand: true,
    };
  }

  const baseConfig: BotChatConfig = {
    atPageHome: DEFAULT_BOT_HOME_PAGE,
    allowCommand: false,
  };

  try {
    const { getFeishuChatInfo } = await import("~~/server/services/messaging");
    const chatInfo = await getFeishuChatInfo(input.chatId);
    const parsed = parseBotChatConfigFromDescription(chatInfo?.description);

    return {
      ...baseConfig,
      ...parsed,
    };
  } catch (error) {
    console.error("[card-command] failed to resolve chat config:", error);
    return baseConfig;
  }
}
