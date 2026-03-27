export interface BotChatConfig {
  atPageHome: string;
  allowCommand: boolean;
}

export interface ResolveBotChatConfigInput {
  chatId: string;
  chatType: string;
}
