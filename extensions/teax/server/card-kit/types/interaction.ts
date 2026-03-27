export interface CardInteractionContext {
  action: Record<string, unknown>;
  openId: string;
  token: string;
  updateCard?: (card: Record<string, unknown>) => Promise<void>;
  sendCard?: (card: Record<string, unknown>) => Promise<void>;
}
