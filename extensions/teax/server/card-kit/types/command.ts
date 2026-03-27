export interface BotMessageContext {
  messageId: string;
  chatId: string;
  chatType: string;
  senderOpenId: string;
  text: string;
}

export interface CardCommandDef {
  name: string;
  description: string;
  usage?: string;
  aliases?: string[];
  linkPattern?: RegExp;
  page: string;
  paramsFromArgs?: (args: string[]) => Record<string, unknown> | undefined;
  paramsFromMatch?: (match: RegExpMatchArray) => Record<string, unknown> | undefined;
}
