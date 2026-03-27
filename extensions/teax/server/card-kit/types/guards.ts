import type { CardJSON } from "./card";
import type { CardDIContext, CardRouteLocation } from "./common";
import type { NavigateResult } from "./navigation";

export interface NavigationGuardContext extends CardDIContext {
  openId: string;
  to: CardRouteLocation;
  from: CardRouteLocation | null;
}

export type GuardResult = boolean | CardJSON | NavigateResult | undefined;
