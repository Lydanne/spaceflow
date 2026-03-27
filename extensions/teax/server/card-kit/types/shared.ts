import type {
  GuardResult,
  NavigationGuardContext,
} from "./guards";

export type BeforeEnterGuard = (
  ctx: NavigationGuardContext,
) => GuardResult | Promise<GuardResult>;
