import type { CardJSON } from "./card";
import type { CardFormValue } from "./common";

export interface DispatchInput {
  openId: string;
  actionValue: unknown;
  formValue?: CardFormValue;
  token: string;
  updateCard: (card: CardJSON) => Promise<void>;
  sendCard?: (card: CardJSON) => Promise<void>;
}
