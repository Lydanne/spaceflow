import type { CardConfig, CardJSON } from "./card";
import type {
  CardDIContext,
  CardFormValue,
  CardParams,
} from "./common";
import type { GuardResult, NavigationGuardContext } from "./guards";
import type { CardActionNavigateOpts, CardActionType } from "./action";
import type { CardActionResult, NavigateResult } from "./navigation";
import type { StackEntry } from "./stack";
import type { EnhancedCardBuilderInterface } from "./builder";

export interface CardPageDef<
  D extends Record<string, unknown> = Record<string, unknown>,
> {
  name: string;
  data?: () => D;
  beforeEnter?: (ctx: NavigationGuardContext) => GuardResult | Promise<GuardResult>;
  beforeLeave?: (ctx: NavigationGuardContext) => GuardResult | Promise<GuardResult>;
  render: (ctx: CardRenderContext<D>) => Promise<CardJSON>;
  onAction?: (ctx: CardActionContext<D>) => CardActionResult | Promise<CardActionResult>;
}

export interface CardRenderContext<
  D extends Record<string, unknown> = Record<string, unknown>,
> extends CardDIContext {
  openId: string;
  params: CardParams;
  data: D;
  card: (config: CardConfig) => EnhancedCardBuilderInterface;
  stack: readonly StackEntry[];
}

export interface CardActionContext<
  D extends Record<string, unknown> = Record<string, unknown>,
> extends CardRenderContext<D> {
  type: CardActionType;
  action: string;
  setData: (partial: Partial<D>) => NavigateResult;
  formValue: CardFormValue | null;
  formName: string | null;
  token: string;
  update: (card: CardJSON) => Promise<void>;
  navigate: (page: string, params?: CardParams, opts?: CardActionNavigateOpts) => Promise<void>;
  back: () => Promise<void>;
}
